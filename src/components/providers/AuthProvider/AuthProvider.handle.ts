import type { Token } from '@solvimon/solvimon-types';
import type { AuthStatus, PortalLinkEnding } from './AuthProvider.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { isApiError } from '@/services/apiError';

/** What an exchange may do to the session it signs in. */
export interface ExchangeSession {
    exchangeHandle: (handle: string) => Promise<Token>;
    applyToken: (token: Token) => void;
    clearToken: () => void;
    hasToken: () => boolean;
    setStatus: (status: AuthStatus) => void;
    /** Every element using the session has left the page. */
    isAbandoned: () => boolean;
    /** The API could not verify the link for now. */
    markUnverified: (err: unknown) => void;
    forEachLogger: (log: (logger: Logger) => void) => void;
}

const EXCHANGE_RETRY_DELAYS_MS = [1000, 2000, 4000];

export const LINK_ENDINGS: Record<string, PortalLinkEnding> = {
    PORTAL_URL_EXPIRED: 'expired',
    PORTAL_URL_REVOKED: 'revoked',
    CHECKOUT_SESSION_CLOSED: 'closed',
};

// No answer, a server or gateway error, or a rate limit says nothing about the link itself.
const isTransient = (err: unknown) =>
    !isApiError(err) || err.statusCode >= 500 || err.statusCode === 429;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function failExchange(session: ExchangeSession, err: unknown) {
    if (isApiError(err) && err.statusCode === 410) {
        session.clearToken();
        const reason = LINK_ENDINGS[err.errorCode ?? ''] ?? 'expired';
        const { checkoutSessionStatus } = err;
        session.setStatus({
            state: 'ended',
            reason,
            ...(checkoutSessionStatus ? { checkoutSessionStatus } : {}),
        });
        session.forEachLogger((logger) => {
            if (reason === 'closed') {
                logger.warn(
                    'CHECKOUT_SESSION_CLOSED',
                    'The checkout session of the portal link is closed',
                    { status: checkoutSessionStatus },
                    err,
                );
            } else if (reason === 'revoked') {
                logger.error('PORTAL_URL_REVOKED', 'The portal link is revoked', {}, err);
            } else {
                logger.error('PORTAL_URL_EXPIRED', 'The portal link has expired', {}, err);
            }
        });
        return;
    }

    if (isTransient(err)) {
        // Mid-session the element stays as it is: the request the API rejected fails on its own.
        session.markUnverified(err);
        return;
    }

    // Mid-session the element stays as it is, as for a link that could not be verified.
    if (!session.hasToken()) {
        session.setStatus({ state: 'invalid' });
    }
    session.forEachLogger((logger) =>
        logger.error('INVALID_TOKEN', 'Failed to fetch access token', {}, err),
    );
}

export async function runExchange(
    handle: string,
    session: ExchangeSession,
): Promise<string | undefined> {
    for (let attempt = 0; ; attempt++) {
        try {
            const token = await session.exchangeHandle(handle);
            session.applyToken(token);
            return token.access_token;
        } catch (err) {
            const delay = EXCHANGE_RETRY_DELAYS_MS[attempt];
            if (isTransient(err) && delay !== undefined) {
                await wait(delay);
                if (session.isAbandoned()) return undefined;
                continue;
            }
            failExchange(session, err);
            return undefined;
        }
    }
}
