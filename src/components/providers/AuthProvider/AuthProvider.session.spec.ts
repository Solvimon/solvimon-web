import type { Mock } from 'vitest';
import { defineComponent, h, provide } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { AUTH_INJECTION_KEY, getAuth } from './AuthProvider.lib';
import { CONFIG_INJECTION_KEY } from '@/components/providers/ConfigProvider/ConfigProvider.lib';
import { LOGGER_PROVIDER_INJECTION_KEY } from '@/components/providers/LoggerProvider/LoggerProvider.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { createRequestService } from '@/services/requests';

/**
 * The session end to end through the real request service and token service: only `fetch` is
 * replaced, so these count the refreshes and retries that actually reach the network.
 */

const IDENTITY = 'https://identity.test/v1';
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

const flush = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
};

let portalCounter = 0;
const portalToken = () => btoa(`portal-user-${++portalCounter}.purl_test`);

const bearerOf = (init: RequestInit) =>
    (init.headers as Record<string, string>)['Authorization']?.replace('Bearer ', '');

let routes: { token: Route; refresh: Route; api: Route };
let fetchMock: Mock;
const callsTo = (kind: 'token' | 'refresh' | 'api') =>
    fetchMock.mock.calls.filter(([url]) => kindOf(url as string) === kind);

function kindOf(url: string): 'token' | 'refresh' | 'api' {
    if (url.endsWith('/oauth/token')) return 'token';
    if (url.endsWith('/oauth/refresh-token')) return 'refresh';
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
}

const mounted: VueWrapper[] = [];

function mountElement(token: string): Element {
    const logger = createLogger();
    let request!: ReturnType<typeof createRequestService>;

    const Leaf = defineComponent({
        setup() {
            request = createRequestService();
            return () => null;
        },
    });
    const Auth = defineComponent({
        setup() {
            provide(AUTH_INJECTION_KEY, getAuth(token));
            return () => h(Leaf);
        },
    });
    const Host = defineComponent({
        setup() {
            provide(CONFIG_INJECTION_KEY, { apiUrls: { identity: IDENTITY } } as never);
            provide(LOGGER_PROVIDER_INJECTION_KEY, logger);
            return () => h(Auth);
        },
    });

    const wrapper = mount(Host);
    mounted.push(wrapper);
    return { wrapper, logger, request };
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

        // Expected failure: the refresh in flight runs on the first element's token service, so
        // its REQUEST_FAILED goes to that element's logger even after it has left the page.
        it.fails('routes the log of a refresh in flight away from a removed element', async () => {
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

        // Expected failure: after a refresh fails, only the timer and the tab becoming visible may
        // start another, and both start one only once the token is within a minute of expiry. A
        // token the API rejects long before that is never replaced, so every request fails with a
        // 401 until then, although the CHANGELOG says the timer retries.
        it.fails(
            'recovers from a failed refresh while the rejected token is far from expiry',
            async () => {
                routes.token = () => tokenReply('T1', 3600);
                let refreshes = 0;
                routes.refresh = () =>
                    ++refreshes === 1
                        ? { status: 503, body: { message: 'down' } }
                        : tokenReply('T2');
                routes.api = (init) => (bearerOf(init) === 'T1' ? { status: 401 } : { body: {} });

                const element = mountElement(portalToken());
                await flush();

                await expect(get(element)).rejects.toMatchObject({ statusCode: 401 });
                expect(callsTo('refresh')).toHaveLength(1);

                await vi.advanceTimersByTimeAsync(5 * 60_000);
                setVisible();
                await flush();

                await expect(get(element)).resolves.toEqual({});
            },
        );

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
});
