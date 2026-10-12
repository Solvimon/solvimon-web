import { onBeforeUnmount, ref, type InjectionKey, type Ref, onMounted } from 'vue';
import type { Token } from '@solvimon/solvimon-types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { createTokensService } from '@/services/tokens';
import { parseToken } from '@/utils/token';

export const AUTH_INJECTION_KEY: InjectionKey<Auth> = Symbol('auth');

const REFRESH_INTERVAL_MS = 30 * 1000;
const REFRESH_MARGIN_MS = 60 * 1000;

export interface Auth {
    accessToken: Ref<string | undefined>;
    /** The access token, refreshed first when it is about to expire. */
    getFreshAccessToken: () => Promise<string | undefined>;
    /** A replacement for a token the API rejected, or `undefined` when there is none to be had. */
    renewAccessToken: (rejected: string | undefined) => Promise<string | undefined>;
}

interface Subscriber {
    logger: Logger;
    tokens: ReturnType<typeof createTokensService>;
}

interface SharedTokenState {
    accessToken: Ref<string | undefined>;
    expiresAt: number | undefined;
    // Each mounted element, so failures reach the hosts still on the page.
    subscribers: Set<Subscriber>;
    refreshInterval: ReturnType<typeof setInterval> | undefined;
    refreshing: Promise<string | undefined> | undefined;
    lastRefreshFailed: boolean;
    consecutiveRefresh401s: number;
    isSessionExpired: boolean;
    onVisibilityChange: () => void;
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

function applyToken(state: SharedTokenState, { access_token, expires_in }: Token) {
    state.accessToken.value = access_token;
    // Relative to now rather than the JWT's `exp`, so a skewed client clock cannot misjudge it.
    state.expiresAt = expires_in > 0 ? Date.now() + expires_in * 1000 : undefined;
}

const isDue = (state: SharedTokenState) =>
    state.expiresAt === undefined || state.expiresAt - Date.now() < REFRESH_MARGIN_MS;

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
    const [subscriber] = state.subscribers;
    if (!subscriber) return undefined;

    try {
        applyToken(state, await subscriber.tokens.refreshAccessToken());
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

function createSharedState(): SharedTokenState {
    const state: SharedTokenState = {
        accessToken: ref<string | undefined>(),
        expiresAt: undefined,
        subscribers: new Set(),
        refreshInterval: undefined,
        refreshing: undefined,
        lastRefreshFailed: false,
        consecutiveRefresh401s: 0,
        isSessionExpired: false,
        // Timers are throttled in a background tab and stop while the laptop sleeps.
        onVisibilityChange: () => {
            if (document.visibilityState === 'visible' && isDue(state)) void refresh(state);
        },
    };

    return state;
}

function startSession(state: SharedTokenState, tokenUserName: string) {
    const fetchToken = async () => {
        const [subscriber] = state.subscribers;
        if (!subscriber) return;

        try {
            applyToken(state, await subscriber.tokens.getAccessToken(tokenUserName));
        } catch (err) {
            forEachLogger(state, (logger) =>
                logger.error('INVALID_TOKEN', 'Failed to fetch access token', {}, err),
            );
        }
    };

    void fetchToken();

    state.refreshInterval = setInterval(() => {
        if (isDue(state)) void refresh(state);
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
});

export const getAuth = (token: string): Auth => {
    const subscriber: Subscriber = { logger: useLogger(), tokens: createTokensService() };

    let tokenUserName: string;
    try {
        ({ tokenUserName } = parseToken(token));
    } catch (err) {
        // Before the shared map is touched, so a bad token leaves nothing behind.
        subscriber.logger.error('INVALID_TOKEN', 'Failed to parse the portal token', {}, err);
        return inertAuth();
    }

    let state = sharedTokenStates.get(token);

    if (!state) {
        const created = createSharedState();
        sharedTokenStates.set(token, created);
        onMounted(() => startSession(created, tokenUserName));
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
            if (shared.expiresAt !== undefined && isDue(shared)) {
                await refreshForRequest(shared);
            }
            return shared.accessToken.value;
        },
        renewAccessToken: async (rejected) => {
            // Another request already replaced it.
            if (shared.accessToken.value !== rejected) return shared.accessToken.value;
            return refreshForRequest(shared);
        },
    };
};
