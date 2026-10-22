import { onBeforeUnmount, ref, type InjectionKey, type Ref, onMounted } from 'vue';
import type { Token } from '@solvimon/solvimon-types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { createTokensService } from '@/services/tokens';
import type { PortalAuthentication } from '@/types/portalAuthentication';
import type { PortalToken } from '@/types/portalToken';
import { parsePortalCredential, type PortalCredential } from '@/utils/token';

export const AUTH_INJECTION_KEY: InjectionKey<Auth> = Symbol('auth');

const REFRESH_INTERVAL_MS = 30 * 1000;
const REFRESH_MARGIN_MS = 60 * 1000;
// After a failed re-exchange the API is given as long as the identity path waits between refreshes.
const EXCHANGE_COOLDOWN_MS = REFRESH_INTERVAL_MS;

/** Why a portal link can no longer be used, from the exchange's 410. */
export type PortalLinkEnding = 'expired' | 'revoked' | 'closed';

export type AuthStatus =
    | { state: 'pending' }
    | { state: 'ready' }
    | { state: 'ended'; reason: PortalLinkEnding; checkoutSessionStatus?: string }
    /** The API could not verify the link for now; `retry` tries again. */
    | { state: 'unavailable' }
    | { state: 'invalid' };

export interface Auth {
    accessToken: Ref<string | undefined>;
    /** The access token, refreshed first when it is about to expire. */
    getFreshAccessToken: () => Promise<string | undefined>;
    /** A replacement for a token the API rejected, or `undefined` when there is none to be had. */
    renewAccessToken: (rejected: string | undefined) => Promise<string | undefined>;
    status: Readonly<Ref<AuthStatus>>;
    /** Exchanges the handle again after the API could not verify the link. */
    retry: () => void;
}

interface SharedTokenState {
    accessToken: Ref<string | undefined>;
    status: Ref<AuthStatus>;
    expiresAt: number | undefined;
    // One per mounted element, so failures reach the hosts still on the page. Wrapped, since two
    // elements may share a logger and the first leaving must not remove the second.
    subscribers: Set<Subscriber>;
    tokens: ReturnType<typeof createTokensService>;
    refreshInterval: ReturnType<typeof setInterval> | undefined;
    refreshing: Promise<string | undefined> | undefined;
    /** Until when a re-exchange may not start, after one failed in the middle of the session. */
    exchangeBlockedUntil: number | undefined;
    lastRefreshFailed: boolean;
    consecutiveRefresh401s: number;
    isSessionExpired: boolean;
    onVisibilityChange: () => void;
}

interface Subscriber {
    logger: Logger;
}

function isUnauthorizedError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null || !('statusCode' in err)) return false;
    return err.statusCode === 401;
}

// One shared state per unique token value so N components on the same page
// share a single fetch + refresh cycle instead of each running their own.
const sharedTokenStates = new Map<string, SharedTokenState>();

const forEachLogger = (state: SharedTokenState, log: (logger: Logger) => void) =>
    state.subscribers.forEach(({ logger }) => log(logger));

/** Logs to an element mounted when the entry is written, or nowhere once none is. */
function createRoutedLogger(subscribers: Set<Subscriber>): Logger {
    const mounted = (): Logger | undefined => subscribers.values().next().value?.logger;

    return {
        debug: (...args) => mounted()?.debug(...args),
        info: (...args) => mounted()?.info(...args),
        warn: (...args) => mounted()?.warn(...args),
        error: (...args) => mounted()?.error(...args),
        capture: (...args) => mounted()?.capture(...args),
    };
}

function applyToken(state: SharedTokenState, { access_token, expires_in }: Token) {
    state.accessToken.value = access_token;
    // Relative to now rather than the JWT's `exp`, so a skewed client clock cannot misjudge it.
    state.expiresAt = expires_in > 0 ? Date.now() + expires_in * 1000 : undefined;
    state.status.value = { state: 'ready' };
}

const isDue = (state: SharedTokenState) =>
    state.expiresAt === undefined || state.expiresAt - Date.now() < REFRESH_MARGIN_MS;

// A failed refresh may have left a token the API already rejects, however far from expiry.
const shouldRetry = (state: SharedTokenState) => state.lastRefreshFailed || isDue(state);

function expireSession(state: SharedTokenState, err: unknown) {
    state.isSessionExpired = true;
    clearInterval(state.refreshInterval);
    state.refreshInterval = undefined;

    // Nothing will renew the session from here, so the host has to be told:
    // it holds the portal token and is the only side that can issue a new one.
    forEachLogger(state, (logger) =>
        logger.error(
            'SESSION_EXPIRED',
            'Stopped refreshing the access token after repeated 401 responses',
            {},
            err,
        ),
    );
}

async function runRefresh(state: SharedTokenState): Promise<string | undefined> {
    if (state.subscribers.size === 0) return undefined;

    try {
        applyToken(state, await state.tokens.refreshAccessToken());
        state.consecutiveRefresh401s = 0;
        state.lastRefreshFailed = false;
        return state.accessToken.value;
    } catch (err) {
        state.lastRefreshFailed = true;
        if (isUnauthorizedError(err) && ++state.consecutiveRefresh401s >= 2) {
            expireSession(state, err);
        }
        return undefined;
    }
}

/** Every caller asking while a refresh is in flight shares it. */
function refresh(state: SharedTokenState): Promise<string | undefined> {
    if (state.isSessionExpired) return Promise.resolve(undefined);

    state.refreshing ??= runRefresh(state).finally(() => {
        state.refreshing = undefined;
    });

    return state.refreshing;
}

/**
 * Requests join a refresh in flight but start one only while the last one succeeded; after a
 * failure the timer and the tab becoming visible retry, so a burst of requests cannot hammer it.
 */
function refreshForRequest(state: SharedTokenState): Promise<string | undefined> {
    if (state.refreshing || !state.lastRefreshFailed) return refresh(state);
    return Promise.resolve(undefined);
}

/**
 * The token lives as long as the link and there is no refresh token, so the handle is exchanged
 * only to start and after the API rejects the token. Every caller shares an exchange in flight.
 */
/** The API could not verify the link: on the first load the element offers to try again. */
function markUnverified(state: SharedTokenState, err: unknown) {
    if (state.accessToken.value === undefined) {
        state.status.value = { state: 'unavailable' };
    }
    forEachLogger(state, (logger) =>
        logger.error(
            'PORTAL_TOKEN_UNAVAILABLE',
            'Could not exchange the portal link handle for a token',
            {},
            err,
        ),
    );
}

function exchange(state: SharedTokenState, handle: string): Promise<string | undefined> {
    // Loaded on demand: only a link that carries a handle needs it, and every element loads this.
    state.refreshing ??= import('./AuthProvider.handle')
        .then(({ runExchange }) =>
            runExchange(handle, {
                exchangeHandle: (value) => state.tokens.exchangeHandle(value),
                applyToken: (token) => applyToken(state, token),
                clearToken: () => {
                    state.accessToken.value = undefined;
                    state.expiresAt = undefined;
                },
                hasToken: () => state.accessToken.value !== undefined,
                setStatus: (status) => {
                    state.status.value = status;
                },
                isAbandoned: () => state.subscribers.size === 0,
                markUnverified: (err) => markUnverified(state, err),
                forEachLogger: (log) => forEachLogger(state, log),
            }),
        )
        .catch((err: unknown) => {
            markUnverified(state, err);
            return undefined;
        })
        .finally(() => {
            state.refreshing = undefined;
        });

    return state.refreshing;
}

function createSharedState(): SharedTokenState {
    const subscribers = new Set<Subscriber>();
    const state: SharedTokenState = {
        accessToken: ref<string | undefined>(),
        status: ref<AuthStatus>({ state: 'pending' }),
        expiresAt: undefined,
        subscribers,
        tokens: createTokensService({ logger: createRoutedLogger(subscribers) }),
        refreshInterval: undefined,
        refreshing: undefined,
        exchangeBlockedUntil: undefined,
        lastRefreshFailed: false,
        consecutiveRefresh401s: 0,
        isSessionExpired: false,
        // Timers are throttled in a background tab and stop while the laptop sleeps.
        onVisibilityChange: () => {
            if (document.visibilityState === 'visible' && shouldRetry(state)) void refresh(state);
        },
    };

    return state;
}

function startSession(
    state: SharedTokenState,
    credential: PortalCredential,
    portalToken: PortalToken | undefined,
) {
    if (credential.kind === 'handle') {
        // The host already exchanged the handle; a token the API rejects is exchanged again then.
        if (typeof portalToken?.access_token === 'string' && portalToken.access_token) {
            applyToken(state, {
                access_token: portalToken.access_token,
                expires_in: portalToken.access_token_expires_in,
                token_type: 'bearer',
            });
            return;
        }
        void exchange(state, credential.handle);
        return;
    }

    const { tokenUserName } = credential;
    const fetchToken = async () => {
        try {
            applyToken(state, await state.tokens.getAccessToken(tokenUserName));
        } catch (err) {
            state.status.value = { state: 'invalid' };
            forEachLogger(state, (logger) =>
                logger.error('INVALID_TOKEN', 'Failed to fetch access token', {}, err),
            );
        }
    };

    void fetchToken();

    state.refreshInterval = setInterval(() => {
        if (shouldRetry(state)) void refresh(state);
    }, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', state.onVisibilityChange);
}

function endSession(token: string, state: SharedTokenState) {
    clearInterval(state.refreshInterval);
    state.refreshInterval = undefined;
    document.removeEventListener('visibilitychange', state.onVisibilityChange);
    sharedTokenStates.delete(token);
}

const inertAuth = (): Auth => ({
    accessToken: ref<string | undefined>(),
    getFreshAccessToken: () => Promise.resolve(undefined),
    renewAccessToken: () => Promise.resolve(undefined),
    status: ref<AuthStatus>({ state: 'invalid' }),
    retry: () => {},
});

export const getAuth = (
    token: string,
    authentication?: PortalAuthentication,
    portalToken?: PortalToken,
): Auth => {
    const subscriber: Subscriber = { logger: useLogger() };

    let credential: PortalCredential;
    try {
        credential = parsePortalCredential(token, authentication);
    } catch (err) {
        // Before the shared map is touched, so a bad token leaves nothing behind.
        subscriber.logger.error('INVALID_TOKEN', 'Failed to parse the portal token', {}, err);
        return inertAuth();
    }

    let state = sharedTokenStates.get(token);

    if (!state) {
        const created = createSharedState();
        sharedTokenStates.set(token, created);
        onMounted(() => startSession(created, credential, portalToken));
        state = created;
    }

    const shared = state;
    shared.subscribers.add(subscriber);

    onBeforeUnmount(() => {
        shared.subscribers.delete(subscriber);

        if (shared.subscribers.size === 0) {
            endSession(token, shared);
        }
    });

    return {
        accessToken: shared.accessToken,
        getFreshAccessToken: async () => {
            if (credential.kind === 'identity' && shared.expiresAt !== undefined && isDue(shared)) {
                await refreshForRequest(shared);
            }
            return shared.accessToken.value;
        },
        renewAccessToken: async (rejected) => {
            // Another request already replaced it.
            if (shared.accessToken.value !== rejected) return shared.accessToken.value;
            if (credential.kind === 'handle') {
                if (shared.refreshing) return shared.refreshing;
                // The API rejects a token whose link is gone; the exchange says why, with a 410.
                // After a failed one the next waits a while, so it is not repeated on every request.
                const blockedUntil = shared.exchangeBlockedUntil ?? 0;
                if (shared.status.value.state !== 'ready' || Date.now() < blockedUntil) {
                    return undefined;
                }
                const renewed = await exchange(shared, credential.handle);
                shared.exchangeBlockedUntil = renewed
                    ? undefined
                    : Date.now() + EXCHANGE_COOLDOWN_MS;
                return renewed;
            }
            return refreshForRequest(shared);
        },
        status: shared.status,
        retry: () => {
            if (credential.kind !== 'handle' || shared.status.value.state !== 'unavailable') return;
            shared.status.value = { state: 'pending' };
            void exchange(shared, credential.handle);
        },
    };
};
