import type { Page, Request, Route } from '@playwright/test';
import { TEST_APP_HOST, TEST_APP_PORT } from '../../../global.config';
import { stripeStubScript, type StripeStubConfig } from './stripe-stub';

/**
 * There is no API and no test environment behind this suite, so every request the SDK makes is
 * answered here and then asserted on. With a mocked backend the payload the SDK sends is as much
 * the subject of a test as what the screen renders off the response.
 *
 * Two rules hold it together:
 * 1. Every request is routed. Anything not matched below is recorded as unmatched and aborted, so
 *    a call added to a screen cannot silently escape to a real host — `identity.solvimon.com` and
 *    `api.solvimon.com` are live hosts, and the suite must never be able to reach them. Only the
 *    endpoints the checkout actually reaches are listed: anything else it calls has to show up as
 *    an unmatched call rather than be quietly answered.
 * 2. Responses are declared per test. The defaults are a starting point each test overrides for
 *    the case it is about, never a fixed world all tests read from.
 */

const APP_ORIGIN = `https://${TEST_APP_HOST}:${TEST_APP_PORT}`;

/** The endpoints the checkout reaches, matched on path so the environment stays out of the specs. */
export const ENDPOINTS = {
    /** `AuthProvider` exchanges the portal token for an access token before anything else runs. */
    accessToken: { method: 'POST', path: '/v1/oauth/token' },
    /** Fired on a 30s interval, so a long test will see it. */
    refreshToken: { method: 'POST', path: '/v1/oauth/refresh-token' },
    subscription: { method: 'GET', path: /^\/v1\/portal\/pricing-plan-subscriptions\/[^/]+$/ },
    invoicePreview: { method: 'POST', path: '/v1/portal/invoices/preview' },
    paymentMethodOptions: { method: 'POST', path: '/v1/portal/payment-method-options' },
    authorizePayment: { method: 'POST', path: '/v1/portal/payments/authorize' },
    /** Third party: `useCheckoutForm` guesses the country when the host names none. */
    geoLocation: { method: 'GET', host: 'api.country.is' },
    /** Third party: stubbed in place of the real Stripe.js. See `stripe-stub.ts`. */
    stripeScript: { method: 'GET', host: 'js.stripe.com' },
} as const satisfies Record<string, EndpointMatcher>;

interface EndpointMatcher {
    method: string;
    host?: string;
    path?: string | RegExp;
}

export type EndpointName = keyof typeof ENDPOINTS;

/** What a test asserts on after the fact. `body` is the parsed JSON payload, if the call had one. */
export interface RecordedCall {
    /** Position among every recorded call, so a test can assert one preceded another. */
    order: number;
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
}

export interface MockResponse {
    /** Defaults to 200. */
    status?: number;
    body?: unknown;
    /** Held for this many ms before answering, so pending states can be asserted on. */
    delayMs?: number;
}

/**
 * A single response, one per call in order (the last repeats once the list runs out), or a function
 * of the request for anything those two cannot express.
 */
export type Responder = MockResponse | MockResponse[] | ((request: Request) => MockResponse);

export interface ApiMock {
    /** Answers `endpoint` from here on, replacing whatever was set before. */
    on(endpoint: EndpointName, responder: Responder): ApiMock;
    /** Every call to `endpoint`, in order — so a test can assert it happened once and not twice. */
    calls(endpoint: EndpointName): RecordedCall[];
    /** The most recent call, which is what most assertions read. */
    lastCall(endpoint: EndpointName): RecordedCall | undefined;
    /** Resolves once `endpoint` has been called `count` times. */
    waitForCall(endpoint: EndpointName, count?: number): Promise<RecordedCall>;
    /** Anything the catch-all caught. Asserted empty at the end of every test. */
    unmatchedCalls(): RecordedCall[];
    /** Page navigations away from the test app — where the checkout sends the customer afterwards. */
    navigations(): string[];
    /** How the stubbed Stripe.js behaves. Read when the frame loads the script. */
    stripe(config: Partial<StripeStubConfig>): ApiMock;
}

function endpointNames(): EndpointName[] {
    return Object.keys(ENDPOINTS).filter(isEndpointName);
}

function isEndpointName(name: string): name is EndpointName {
    return name in ENDPOINTS;
}

function matches(matcher: EndpointMatcher, request: Request, url: URL): boolean {
    if (matcher.method !== request.method()) return false;
    if (matcher.host && matcher.host !== url.host) return false;
    if (typeof matcher.path === 'string' && matcher.path !== url.pathname) return false;
    if (matcher.path instanceof RegExp && !matcher.path.test(url.pathname)) return false;

    return true;
}

function resolveResponse(responder: Responder, request: Request, callIndex: number): MockResponse {
    if (typeof responder === 'function') return responder(request);
    if (Array.isArray(responder)) {
        return responder[Math.min(callIndex, responder.length - 1)] ?? {};
    }

    return responder;
}

async function recordOf(request: Request, order: number): Promise<RecordedCall> {
    let body: unknown;
    try {
        body = request.postDataJSON();
    } catch {
        body = request.postData() ?? undefined;
    }

    return {
        order,
        url: request.url(),
        method: request.method(),
        headers: await request.allHeaders(),
        body,
    };
}

/** `credentials: 'omit'` means no cookies, so a wildcard origin is all the mocks need. */
const CORS_HEADERS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    'access-control-allow-headers': '*',
};

/**
 * Installs the route handlers on `page`. Must run before navigating, because the token exchange
 * starts as soon as the screen mounts.
 */
export async function installApiMock(
    page: Page,
    defaults: Partial<Record<EndpointName, Responder>> = {},
): Promise<ApiMock> {
    const responders = new Map<EndpointName, Responder>();
    endpointNames().forEach((name) => {
        const responder = defaults[name];
        if (responder) responders.set(name, responder);
    });
    const recorded = new Map<EndpointName, RecordedCall[]>();
    const unmatched: RecordedCall[] = [];
    const navigations: string[] = [];
    let order = 0;
    const waiters: { endpoint: EndpointName; count: number; resolve: (c: RecordedCall) => void }[] =
        [];
    const stripeConfig: StripeStubConfig = {
        confirmationTokenId: 'ctoken_test_default',
        submitError: undefined,
        confirmationTokenError: undefined,
        nextActionError: undefined,
    };

    const record = (endpoint: EndpointName, call: RecordedCall) => {
        const calls = recorded.get(endpoint) ?? [];
        calls.push(call);
        recorded.set(endpoint, calls);

        waiters
            .filter((waiter) => waiter.endpoint === endpoint && waiter.count <= calls.length)
            .forEach((waiter) => {
                waiter.resolve(call);
                waiters.splice(waiters.indexOf(waiter), 1);
            });
    };

    const findEndpoint = (request: Request, url: URL): EndpointName | undefined =>
        endpointNames().find((name) => matches(ENDPOINTS[name], request, url));

    const handle = async (route: Route) => {
        const request = route.request();
        const url = new URL(request.url());

        // The app itself, its modules and its assets are served by the dev server as usual.
        if (url.origin === APP_ORIGIN) {
            return route.continue();
        }

        // Every mocked host is cross-origin, so the browser preflights the calls that carry an
        // Authorization header. Answered here rather than recorded — it is the browser's request,
        // not the SDK's.
        if (request.method() === 'OPTIONS') {
            return route.fulfill({ status: 204, headers: CORS_HEADERS });
        }

        // The checkout sends the customer on to the merchant's success url when the payment goes
        // through. Answered with a blank page so the navigation completes and can be asserted on,
        // rather than aborted as an escaped request.
        if (request.isNavigationRequest()) {
            navigations.push(request.url());
            return route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<!doctype html><title>External page</title>',
            });
        }

        const endpoint = findEndpoint(request, url);

        if (!endpoint) {
            unmatched.push(await recordOf(request, order++));
            return route.abort('failed');
        }

        const callIndex = recorded.get(endpoint)?.length ?? 0;
        record(endpoint, await recordOf(request, order++));

        if (endpoint === 'stripeScript') {
            return route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                headers: CORS_HEADERS,
                body: stripeStubScript(stripeConfig),
            });
        }

        const responder = responders.get(endpoint);

        if (!responder) {
            // Matched but undeclared: a test reached an endpoint it never said anything about.
            // Answering 501 makes that read as itself rather than as a request that hung.
            return route.fulfill({
                status: 501,
                contentType: 'application/json',
                headers: CORS_HEADERS,
                body: JSON.stringify({ message: `No mock declared for "${endpoint}"` }),
            });
        }

        const response = resolveResponse(responder, request, callIndex);

        if (response.delayMs) {
            await new Promise((resolve) => setTimeout(resolve, response.delayMs));
        }

        return route.fulfill({
            status: response.status ?? 200,
            contentType: 'application/json',
            headers: CORS_HEADERS,
            body: JSON.stringify(response.body ?? {}),
        });
    };

    await page.route('**/*', (route) => {
        void handle(route).catch(() => route.abort('failed'));
    });

    const api: ApiMock = {
        on(endpoint, responder) {
            responders.set(endpoint, responder);
            return api;
        },
        calls: (endpoint) => recorded.get(endpoint) ?? [],
        lastCall: (endpoint) => (recorded.get(endpoint) ?? []).at(-1),
        waitForCall(endpoint, count = 1) {
            const calls = recorded.get(endpoint) ?? [];
            if (calls.length >= count) return Promise.resolve(calls[count - 1]!);

            return new Promise((resolve) => waiters.push({ endpoint, count, resolve }));
        },
        unmatchedCalls: () => unmatched,
        navigations: () => navigations,
        stripe(config) {
            Object.assign(stripeConfig, config);
            return api;
        },
    };

    return api;
}
