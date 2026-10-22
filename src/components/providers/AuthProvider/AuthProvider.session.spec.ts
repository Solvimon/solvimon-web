import type { Mock } from 'vitest';
import { defineComponent, h, provide } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { AUTH_INJECTION_KEY, getAuth, type Auth } from './AuthProvider.lib';
import { CONFIG_INJECTION_KEY } from '@/components/providers/ConfigProvider/ConfigProvider.lib';
import { LOGGER_PROVIDER_INJECTION_KEY } from '@/components/providers/LoggerProvider/LoggerProvider.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { createRequestService } from '@/services/requests';
import type { PortalAuthentication } from '@/types/portalAuthentication';

/**
 * The session end to end through the real request service and token service: only `fetch` is
 * replaced, so these count the refreshes and retries that actually reach the network.
 */

const IDENTITY = 'https://identity.test/v1';
const TRANSACTION = 'https://api.test/v1';
const API = 'https://api.test/v1/portal/thing';

type Body = Record<string, unknown>;
interface Reply {
    status?: number;
    body?: Body;
}
type Route = (init: RequestInit) => Reply | Promise<Reply>;

interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

const MISSING = Symbol('missing');

const tokenReply = (access_token: string, expires_in: unknown = 3600): Reply => ({
    body:
        expires_in === MISSING
            ? { access_token, token_type: 'Bearer' }
            : { access_token, expires_in, token_type: 'Bearer' },
});

const exchangeReply = (access_token: string, expiresIn = 3600): Reply => ({
    status: 201,
    body: {
        issued_at: '2026-10-22T10:00:00.000Z',
        access_token,
        access_token_expires_in: expiresIn,
        access_token_expires_at: '2026-10-22T11:00:00.000Z',
        token_type: 'bearer',
    },
});

const linkGone = (code: string, checkoutSessionStatus?: string): Reply => ({
    status: 410,
    body: {
        type: 'INVALID_REQUEST',
        code,
        message: 'portal url is no longer usable',
        ...(checkoutSessionStatus ? { checkout_session: { status: checkoutSessionStatus } } : {}),
    },
});

let handleCounter = 0;
// The shape the backend issues: base64url(link id) + "." + 43 random characters.
const portalHandle = () => {
    const handle = `${btoa(`purl_${++handleCounter}`).replace(/=+$/, '')}.${'a'.repeat(43)}`;
    seenTokens.add(handle);
    return handle;
};

const warnsLogged = (logger: Logger, code: string) =>
    (logger.warn as Mock).mock.calls.filter(([c]) => c === code).length;

const flush = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
};

let portalCounter = 0;
const portalToken = () => btoa(`portal-user-${++portalCounter}.purl_test`);

const bearerOf = (init: RequestInit) =>
    (init.headers as Record<string, string>)['Authorization']?.replace('Bearer ', '');

type Kind = 'token' | 'refresh' | 'exchange' | 'api';

let routes: Record<Kind, Route>;
let fetchMock: Mock;
const callsTo = (kind: Kind) =>
    fetchMock.mock.calls.filter(([url]) => kindOf(url as string) === kind);

function kindOf(url: string): Kind {
    if (url.endsWith('/oauth/token')) return 'token';
    if (url.endsWith('/oauth/refresh-token')) return 'refresh';
    if (url === `${TRANSACTION}/portal/token`) return 'exchange';
    return 'api';
}

const loggers: Logger[] = [];
const seenTokens = new Set<string>();

function createLogger(): Logger {
    const logger: Logger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        capture: vi.fn(),
    };
    loggers.push(logger);
    return logger;
}

const codesLogged = (logger: Logger, code: string) =>
    (logger.error as Mock).mock.calls.filter(([c]) => c === code).length;

interface Element {
    wrapper: VueWrapper;
    logger: Logger;
    request: ReturnType<typeof createRequestService>;
    auth: Auth;
}

const mounted: VueWrapper[] = [];

function mountElement(token: string, authentication?: PortalAuthentication): Element {
    const logger = createLogger();
    let request!: ReturnType<typeof createRequestService>;
    let auth!: Auth;

    const Leaf = defineComponent({
        setup() {
            request = createRequestService();
            return () => null;
        },
    });
    const Auth = defineComponent({
        setup() {
            auth = getAuth(token, authentication);
            provide(AUTH_INJECTION_KEY, auth);
            return () => h(Leaf);
        },
    });
    const Host = defineComponent({
        setup() {
            provide(CONFIG_INJECTION_KEY, {
                apiUrls: { identity: IDENTITY, transaction: TRANSACTION },
            } as never);
            provide(LOGGER_PROVIDER_INJECTION_KEY, logger);
            return () => h(Auth);
        },
    });

    const wrapper = mount(Host);
    mounted.push(wrapper);
    return { wrapper, logger, request, auth };
}

const get = (element: Element) => element.request<Body>({ url: API });

function setVisible() {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
}

describe('auth session through the request service', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        routes = {
            token: () => tokenReply('T1'),
            refresh: () => tokenReply('T2'),
            exchange: () => exchangeReply('P1'),
            api: () => ({ body: { ok: true } }),
        };
        fetchMock = vi.fn(async (url: string, init: RequestInit) => {
            const reply = await routes[kindOf(url)](init);
            if (reply.body && typeof reply.body.access_token === 'string') {
                seenTokens.add(reply.body.access_token);
            }
            const status = reply.status ?? 200;
            return {
                ok: status >= 200 && status < 300,
                status,
                headers: new Headers({ 'Content-Type': 'application/json' }),
                json: async () => reply.body ?? {},
            };
        });
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        // No token, and no Authorization header, may ever reach a logger.
        const logged = loggers
            .flatMap((logger) =>
                Object.values(logger).flatMap((fn) => (fn as Mock).mock.calls.flat()),
            )
            .map((arg) =>
                arg instanceof Error ? `${arg.message} ${arg.stack}` : JSON.stringify(arg),
            )
            .join('\n');
        seenTokens.forEach((token) => expect(logged).not.toContain(token));
        expect(logged).not.toMatch(/Bearer/);

        mounted.splice(0).forEach((wrapper) => wrapper.unmount());
        loggers.splice(0);
        seenTokens.clear();
        vi.useRealTimers();
    });

    describe('concurrency', () => {
        it('makes exactly one refresh for N parallel requests with an expiring token', async () => {
            routes.token = () => tokenReply('T1', 30);
            const refresh = deferred<Reply>();
            routes.refresh = () => refresh.promise;

            const element = mountElement(portalToken());
            await flush();

            const results = Promise.all(Array.from({ length: 6 }, () => get(element)));
            await flush();
            expect(callsTo('refresh')).toHaveLength(1);
            expect(callsTo('api')).toHaveLength(0);

            refresh.resolve(tokenReply('T2'));
            await expect(results).resolves.toHaveLength(6);

            expect(callsTo('refresh')).toHaveLength(1);
            expect(callsTo('api').map(([, init]) => bearerOf(init))).toEqual(Array(6).fill('T2'));
        });

        it('makes exactly one refresh for N parallel requests rejected with a 401', async () => {
            routes.api = (init) => (bearerOf(init) === 'T2' ? { body: {} } : { status: 401 });

            const element = mountElement(portalToken());
            await flush();

            await expect(
                Promise.all(Array.from({ length: 6 }, () => get(element))),
            ).resolves.toHaveLength(6);

            expect(callsTo('refresh')).toHaveLength(1);
            expect(callsTo('api')).toHaveLength(12);
        });

        it('fails the waiters cleanly after a failed refresh, with no storm', async () => {
            routes.token = () => tokenReply('T1', 30);
            routes.refresh = () => ({ status: 500, body: { message: 'down' } });

            const element = mountElement(portalToken());
            await flush();

            // The burst goes out with the old token rather than hanging on the refresh.
            await expect(
                Promise.all(Array.from({ length: 5 }, () => get(element))),
            ).resolves.toHaveLength(5);
            await Promise.all(Array.from({ length: 5 }, () => get(element)));
            expect(callsTo('refresh')).toHaveLength(1);

            // Now the API rejects the old token: every request fails, still without a refresh each.
            routes.api = () => ({ status: 401 });
            const settled = await Promise.allSettled(Array.from({ length: 5 }, () => get(element)));
            expect(settled.every(({ status }) => status === 'rejected')).toBe(true);
            expect(callsTo('refresh')).toHaveLength(1);

            // The timer is what retries.
            await vi.advanceTimersByTimeAsync(30_000);
            expect(callsTo('refresh')).toHaveLength(2);
        });

        it('expires the session once per element after two 401s, then never refreshes again', async () => {
            routes.token = () => tokenReply('T1', 30);
            routes.refresh = () => ({ status: 401 });
            routes.api = () => ({ status: 401 });

            const token = portalToken();
            const a = mountElement(token);
            const b = mountElement(token);
            await flush();

            await expect(get(a)).rejects.toMatchObject({ statusCode: 401 });
            expect(callsTo('refresh')).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(30_000);
            expect(callsTo('refresh')).toHaveLength(2);
            expect(codesLogged(a.logger, 'SESSION_EXPIRED')).toBe(1);
            expect(codesLogged(b.logger, 'SESSION_EXPIRED')).toBe(1);

            await Promise.allSettled([get(a), get(b), get(a), get(b)]);
            await vi.advanceTimersByTimeAsync(10 * 60_000);
            setVisible();
            await flush();

            expect(callsTo('refresh')).toHaveLength(2);
            expect(codesLogged(a.logger, 'SESSION_EXPIRED')).toBe(1);
            expect(codesLogged(b.logger, 'SESSION_EXPIRED')).toBe(1);
        });

        it('shares the refresh between a 401 retry and a timer refresh in flight', async () => {
            routes.token = () => tokenReply('T1', 61);
            const apiReply = deferred<Reply>();
            const refresh = deferred<Reply>();
            routes.api = (init) => (bearerOf(init) === 'T1' ? apiReply.promise : { body: {} });
            routes.refresh = () => refresh.promise;

            const element = mountElement(portalToken());
            await flush();

            const result = get(element);
            await flush();
            expect(callsTo('refresh')).toHaveLength(0);

            await vi.advanceTimersByTimeAsync(30_000);
            expect(callsTo('refresh')).toHaveLength(1);

            apiReply.resolve({ status: 401 });
            await flush();
            refresh.resolve(tokenReply('T2'));

            await expect(result).resolves.toEqual({});
            expect(callsTo('refresh')).toHaveLength(1);
            expect(callsTo('api').map(([, init]) => bearerOf(init))).toEqual(['T1', 'T2']);
        });

        it('retries with the token a timer refresh already put in place', async () => {
            routes.token = () => tokenReply('T1', 61);
            const apiReply = deferred<Reply>();
            routes.api = (init) => (bearerOf(init) === 'T1' ? apiReply.promise : { body: {} });

            const element = mountElement(portalToken());
            await flush();

            const result = get(element);
            await vi.advanceTimersByTimeAsync(30_000);
            expect(callsTo('refresh')).toHaveLength(1);

            apiReply.resolve({ status: 401 });
            await expect(result).resolves.toEqual({});
            expect(callsTo('refresh')).toHaveLength(1);
        });

        it('joins a refresh in flight when the tab becomes visible', async () => {
            routes.token = () => tokenReply('T1', 30);
            const refresh = deferred<Reply>();
            routes.refresh = () => refresh.promise;

            const element = mountElement(portalToken());
            await flush();

            const result = get(element);
            await flush();
            setVisible();
            await flush();
            expect(callsTo('refresh')).toHaveLength(1);

            refresh.resolve(tokenReply('T2'));
            await expect(result).resolves.toEqual({ ok: true });
            expect(callsTo('refresh')).toHaveLength(1);
        });

        it('finishes a refresh whose element was removed while it was in flight', async () => {
            routes.token = () => tokenReply('T1', 30);
            const refresh = deferred<Reply>();
            routes.refresh = () => refresh.promise;

            const token = portalToken();
            const first = mountElement(token);
            const second = mountElement(token);
            await flush();

            const result = get(second);
            await flush();
            expect(callsTo('refresh')).toHaveLength(1);

            first.wrapper.unmount();
            refresh.resolve(tokenReply('T2'));

            await expect(result).resolves.toEqual({ ok: true });
            expect(callsTo('api').map(([, init]) => bearerOf(init))).toEqual(['T2']);
        });

        it('reports the session ending only to the element left on the page', async () => {
            routes.token = () => tokenReply('T1', 30);
            routes.refresh = () => ({ status: 401 });

            const token = portalToken();
            const first = mountElement(token);
            const second = mountElement(token);
            await flush();
            first.wrapper.unmount();

            await vi.advanceTimersByTimeAsync(60_000);

            expect(callsTo('refresh')).toHaveLength(2);
            expect(codesLogged(first.logger, 'SESSION_EXPIRED')).toBe(0);
            expect(codesLogged(second.logger, 'SESSION_EXPIRED')).toBe(1);
            expect(first.logger.warn).not.toHaveBeenCalled();
        });

        it('routes the log of a refresh in flight away from a removed element', async () => {
            routes.token = () => tokenReply('T1', 30);
            const refresh = deferred<Reply>();
            routes.refresh = () => refresh.promise;

            const token = portalToken();
            const first = mountElement(token);
            const second = mountElement(token);
            await flush();

            void get(second).catch(() => {});
            await flush();
            first.wrapper.unmount();
            refresh.resolve({ status: 500, body: { message: 'down' } });
            await flush();

            expect(first.logger.error).not.toHaveBeenCalled();
            expect(second.logger.error).toHaveBeenCalledWith(
                'REQUEST_FAILED',
                expect.anything(),
                expect.anything(),
                expect.anything(),
            );
        });

        it('recovers from a failed refresh while the rejected token is far from expiry', async () => {
            routes.token = () => tokenReply('T1', 3600);
            let refreshes = 0;
            routes.refresh = () =>
                ++refreshes === 1 ? { status: 503, body: { message: 'down' } } : tokenReply('T2');
            routes.api = (init) => (bearerOf(init) === 'T1' ? { status: 401 } : { body: {} });

            const element = mountElement(portalToken());
            await flush();

            await expect(get(element)).rejects.toMatchObject({ statusCode: 401 });
            expect(callsTo('refresh')).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(5 * 60_000);
            setVisible();
            await flush();

            await expect(get(element)).resolves.toEqual({});
        });

        it('keeps two elements with different tokens apart', async () => {
            routes.token = (init) => {
                const alias = JSON.parse(String(init.body)).token_alias as string;
                return alias === `portal-user-${portalCounter}`
                    ? tokenReply('Y1', 3600)
                    : tokenReply('X1', 30);
            };
            routes.refresh = () => ({ status: 401 });
            routes.api = (init) => (bearerOf(init) === 'X1' ? { status: 401 } : { body: {} });

            const x = mountElement(portalToken());
            const y = mountElement(portalToken());
            await flush();

            await expect(get(y)).resolves.toEqual({});
            expect(callsTo('refresh')).toHaveLength(0);

            await vi.advanceTimersByTimeAsync(60_000);
            expect(codesLogged(x.logger, 'SESSION_EXPIRED')).toBe(1);
            expect(codesLogged(y.logger, 'SESSION_EXPIRED')).toBe(0);

            await expect(get(y)).resolves.toEqual({});
            expect(callsTo('api').map(([, init]) => bearerOf(init))).toEqual(['Y1', 'Y1']);
        });
    });

    describe('what is retried', () => {
        it.each([
            ['a 500', () => ({ status: 500 })],
            ['a 403', () => ({ status: 403 })],
            ['a 404', () => ({ status: 404 })],
        ])('does not retry or refresh on %s', async (_, reply) => {
            routes.api = reply;
            const element = mountElement(portalToken());
            await flush();

            await expect(
                element.request({ url: API, options: { method: 'POST' }, data: { amount: 1 } }),
            ).rejects.toBeDefined();
            expect(callsTo('api')).toHaveLength(1);
            expect(callsTo('refresh')).toHaveLength(0);
        });

        it('does not retry or refresh when the network fails', async () => {
            routes.api = () => Promise.reject(new TypeError('Failed to fetch'));
            const element = mountElement(portalToken());
            await flush();

            await expect(
                element.request({ url: API, options: { method: 'POST' }, data: { amount: 1 } }),
            ).rejects.toBeInstanceOf(TypeError);
            expect(callsTo('api')).toHaveLength(1);
            expect(callsTo('refresh')).toHaveLength(0);
        });

        it('retries a 401 once, with the same body and without credentials', async () => {
            routes.api = (init) => (bearerOf(init) === 'T1' ? { status: 401 } : { body: {} });
            const element = mountElement(portalToken());
            await flush();

            await element.request({ url: API, options: { method: 'POST' }, data: { amount: 1 } });

            const [first, retry] = callsTo('api').map(([, init]) => init as RequestInit);
            expect(retry.body).toBe(first.body);
            expect([first.credentials, retry.credentials]).toEqual(['omit', 'omit']);
            expect(callsTo('refresh').map(([, init]) => init.credentials)).toEqual(['include']);
            expect(callsTo('token').map(([, init]) => init.credentials)).toEqual(['include']);
            expect(callsTo('refresh').map(([, init]) => bearerOf(init))).toEqual([undefined]);
        });
    });

    describe('expires_in from the server', () => {
        const countOver5Minutes = async (expiresIn: unknown, requests = 3) => {
            routes.token = () => tokenReply('T1', expiresIn);
            routes.refresh = () => tokenReply('T2', expiresIn);
            const element = mountElement(portalToken());
            await flush();
            for (let i = 0; i < requests; i++) await get(element);
            const byRequests = callsTo('refresh').length;
            await vi.advanceTimersByTimeAsync(5 * 60_000);
            return { byRequests, total: callsTo('refresh').length };
        };

        it.each([
            ['0', 0],
            ['negative', -5],
            ['missing', MISSING],
            ['a non-numeric string', 'abc'],
        ])('falls back to the 30s timer when it is %s, never a tight loop', async (_, value) => {
            const { byRequests, total } = await countOver5Minutes(value);
            expect(byRequests).toBe(0);
            expect(total).toBe(10);
        });

        it('reads a numeric string as seconds', async () => {
            const { total } = await countOver5Minutes('3600');
            expect(total).toBe(0);
        });

        it('never refreshes ahead of time when it is huge, but still renews on a 401', async () => {
            routes.token = () => tokenReply('T1', 1e300);
            const element = mountElement(portalToken());
            await flush();
            await vi.advanceTimersByTimeAsync(5 * 60_000);
            expect(callsTo('refresh')).toHaveLength(0);

            routes.api = (init) => (bearerOf(init) === 'T1' ? { status: 401 } : { body: {} });
            await expect(get(element)).resolves.toEqual({});
            expect(callsTo('refresh')).toHaveLength(1);
        });

        it('refreshes before every request when it is under the one-minute margin', async () => {
            const { byRequests } = await countOver5Minutes(1, 3);
            // One refresh per request rather than a loop, but every request pays for a round trip.
            expect(byRequests).toBe(3);
        });
    });

    describe('a link that carries a handle', () => {
        const mountHandle = (handle = portalHandle()) => mountElement(handle, 'SIGNED_TOKEN');

        // The exchange is loaded on demand, so the first one waits for its module too.
        const settle = async () => {
            await flush();
            await vi.dynamicImportSettled();
            await flush();
        };

        it('exchanges the handle once, without a bearer or credentials, and never calls identity', async () => {
            const handle = portalHandle();
            const element = mountHandle(handle);
            await settle();

            const [[url, init]] = callsTo('exchange');
            expect(url).toBe(`${TRANSACTION}/portal/token`);
            expect(JSON.parse(String(init.body))).toEqual({ handle });
            expect(init.credentials).toBe('omit');
            expect(bearerOf(init)).toBeUndefined();
            expect(element.auth.status.value).toEqual({ state: 'ready' });
            expect(callsTo('token')).toHaveLength(0);
            expect(callsTo('refresh')).toHaveLength(0);
        });

        it('sends the exchanged token and never refreshes it, also close to its expiry', async () => {
            routes.exchange = () => exchangeReply('P1', 30);
            const element = mountHandle();
            await settle();

            await vi.advanceTimersByTimeAsync(10 * 60_000);
            setVisible();
            await get(element);

            expect(callsTo('api').map(([, init]) => bearerOf(init))).toEqual(['P1']);
            expect(callsTo('exchange')).toHaveLength(1);
            expect(callsTo('refresh')).toHaveLength(0);
        });

        it('shares one exchange between two elements with the same handle', async () => {
            const handle = portalHandle();
            const a = mountHandle(handle);
            const b = mountHandle(handle);
            await settle();

            expect(callsTo('exchange')).toHaveLength(1);
            expect(a.auth.accessToken.value).toBe('P1');
            expect(b.auth.accessToken.value).toBe('P1');
        });

        it('exchanges again once when the API rejects the token, and retries with the new one', async () => {
            let exchanges = 0;
            routes.exchange = () => exchangeReply(++exchanges === 1 ? 'P1' : 'P2');
            routes.api = (init) => (bearerOf(init) === 'P1' ? { status: 401 } : { body: {} });
            const element = mountHandle();
            await settle();

            await expect(
                Promise.all(Array.from({ length: 4 }, () => get(element))),
            ).resolves.toHaveLength(4);

            expect(callsTo('exchange')).toHaveLength(2);
            expect(callsTo('api').map(([, init]) => bearerOf(init))).toEqual([
                ...Array(4).fill('P1'),
                ...Array(4).fill('P2'),
            ]);
        });

        it.each([
            ['PORTAL_URL_EXPIRED', 'expired'],
            ['PORTAL_URL_REVOKED', 'revoked'],
        ])('ends the session on a 410 with %s, without asking again', async (code, reason) => {
            const element = mountHandle();
            await settle();
            routes.exchange = () => linkGone(code);
            routes.api = () => ({ status: 401 });

            await expect(get(element)).rejects.toMatchObject({ statusCode: 401 });

            expect(element.auth.status.value).toEqual({ state: 'ended', reason });
            expect(element.auth.accessToken.value).toBeUndefined();
            expect(codesLogged(element.logger, code)).toBe(1);

            await Promise.allSettled([get(element), get(element)]);
            await vi.advanceTimersByTimeAsync(10 * 60_000);
            expect(callsTo('exchange')).toHaveLength(2);
            expect(codesLogged(element.logger, code)).toBe(1);
        });

        it('ends the session with the outcome of a closed checkout session', async () => {
            routes.exchange = () => linkGone('CHECKOUT_SESSION_CLOSED', 'COMPLETED');
            const element = mountHandle();
            await settle();

            expect(element.auth.status.value).toEqual({
                state: 'ended',
                reason: 'closed',
                checkoutSessionStatus: 'COMPLETED',
            });
            expect(warnsLogged(element.logger, 'CHECKOUT_SESSION_CLOSED')).toBe(1);
            expect(element.logger.error).not.toHaveBeenCalled();
            expect(callsTo('exchange')).toHaveLength(1);
        });

        it('retries a 503 with backoff, then offers a retry that can recover', async () => {
            routes.exchange = () => ({ status: 503, body: { message: 'unable to verify' } });
            const element = mountHandle();
            await settle();
            expect(callsTo('exchange')).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(1000);
            await vi.advanceTimersByTimeAsync(2000);
            await vi.advanceTimersByTimeAsync(4000);
            expect(callsTo('exchange')).toHaveLength(4);
            expect(element.auth.status.value).toEqual({ state: 'unavailable' });
            expect(codesLogged(element.logger, 'PORTAL_TOKEN_UNAVAILABLE')).toBe(1);
            expect(codesLogged(element.logger, 'PORTAL_URL_EXPIRED')).toBe(0);

            await vi.advanceTimersByTimeAsync(10 * 60_000);
            expect(callsTo('exchange')).toHaveLength(4);

            routes.exchange = () => exchangeReply('P1');
            element.auth.retry();
            await settle();
            expect(callsTo('exchange')).toHaveLength(5);
            expect(element.auth.status.value).toEqual({ state: 'ready' });
        });

        it('keeps the element when the link cannot be verified again in the middle of a session', async () => {
            const element = mountHandle();
            await settle();
            routes.exchange = () => ({ status: 503 });
            routes.api = () => ({ status: 401 });

            // Caught as it starts: it rejects while the timers run, before anything awaits it.
            const result = get(element).catch((error: unknown) => error);
            await vi.advanceTimersByTimeAsync(7000);

            expect(await result).toMatchObject({ statusCode: 401 });
            expect(callsTo('exchange')).toHaveLength(5);
            expect(element.auth.accessToken.value).toBe('P1');
            expect(element.auth.status.value).toEqual({ state: 'ready' });
            expect(codesLogged(element.logger, 'PORTAL_TOKEN_UNAVAILABLE')).toBe(1);
        });

        it.each([500, 502, 504, 429])(
            'retries a %i like a link that could not be verified',
            async (status) => {
                routes.exchange = () => ({ status });
                const element = mountHandle();
                await settle();
                await vi.advanceTimersByTimeAsync(7000);

                expect(callsTo('exchange')).toHaveLength(4);
                expect(element.auth.status.value).toEqual({ state: 'unavailable' });
            },
        );

        it('keeps the element when the handle is refused in the middle of a session', async () => {
            const element = mountHandle();
            await settle();
            routes.exchange = () => ({ status: 401 });
            routes.api = () => ({ status: 401 });

            await expect(get(element)).rejects.toMatchObject({ statusCode: 401 });

            expect(element.auth.accessToken.value).toBe('P1');
            expect(element.auth.status.value).toEqual({ state: 'ready' });
            expect(codesLogged(element.logger, 'INVALID_TOKEN')).toBe(1);
        });

        it('exchanges once for a rejected token, not again on every request after it failed', async () => {
            const element = mountHandle();
            await settle();
            routes.exchange = () => ({ status: 401 });
            routes.api = () => ({ status: 401 });

            await Promise.allSettled([get(element), get(element)]);
            await Promise.allSettled([get(element), get(element), get(element)]);

            expect(callsTo('exchange')).toHaveLength(2);
        });

        it('recovers from a 503 within the retries without reporting it', async () => {
            let exchanges = 0;
            routes.exchange = () => (++exchanges === 1 ? { status: 503 } : exchangeReply('P1'));
            const element = mountHandle();
            await settle();

            await vi.advanceTimersByTimeAsync(1000);
            expect(element.auth.status.value).toEqual({ state: 'ready' });
            expect(element.logger.error).not.toHaveBeenCalled();
        });

        it('refuses an unknown handle without retrying', async () => {
            routes.exchange = () => ({ status: 401, body: { message: 'invalid credentials' } });
            const element = mountHandle();
            await settle();
            await vi.advanceTimersByTimeAsync(10 * 60_000);

            expect(callsTo('exchange')).toHaveLength(1);
            expect(element.auth.status.value).toEqual({ state: 'invalid' });
            expect(codesLogged(element.logger, 'INVALID_TOKEN')).toBe(1);
        });

        it('sends nothing for a handle that is not one', async () => {
            const element = mountElement('not a handle', 'SIGNED_TOKEN');
            await settle();

            expect(fetchMock).not.toHaveBeenCalled();
            expect(codesLogged(element.logger, 'INVALID_TOKEN')).toBe(1);
        });
    });
});
