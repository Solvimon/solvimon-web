import type { Page } from '@playwright/test';
import { installApiMock, type ApiMock, type EndpointName, type Responder } from './api-mock';
import { anAccessTokenResponse, type Json } from './fixtures';
import type { StripeStubConfig } from './stripe-stub';

/** The screens the test app can mount, as `createScreen` names them. */
export type ScreenId =
    | 'checkout'
    | 'customer-overview'
    | 'subscription-management'
    | 'subscription-details'
    | 'pay-invoice'
    | 'payment-methods-management';

export interface ScreenOptions {
    portalObject?: Json;
    configuration?: Json;
    /** Per-endpoint overrides, applied over whatever defaults the screen's harness declares. */
    mocks?: Partial<Record<EndpointName, Responder>>;
    /** How the stubbed Stripe.js behaves. */
    stripe?: Partial<StripeStubConfig>;
    /** Extra query parameters, for the cases a screen reads one. */
    query?: Record<string, string>;
    /** Seeded before the app boots. */
    sessionStorage?: Record<string, string>;
}

/** Answered for every screen: each one exchanges the portal token before it does anything else. */
export const sharedMocks: Partial<Record<EndpointName, Responder>> = {
    accessToken: { body: anAccessTokenResponse() },
    refreshToken: { body: anAccessTokenResponse() },
};

/**
 * Installs the mocks, hands the test app its scenario and navigates. The app reads
 * `window.__SOLVIMON_TEST_CONFIG__`, which an init script puts in place before it boots.
 */
export async function mountScreen(
    page: Page,
    screen: ScreenId,
    options: ScreenOptions,
    defaults: Partial<Record<EndpointName, Responder>>,
): Promise<ApiMock> {
    const api = await installApiMock(page, { ...defaults, ...options.mocks });

    if (options.stripe) {
        api.stripe(options.stripe);
    }

    await page.addInitScript(
        (config) => {
            Object.assign(window, { __SOLVIMON_TEST_CONFIG__: config });
        },
        {
            screen,
            // The published environment, so nothing can resolve to internal infrastructure even if
            // a request were ever to escape the mocks.
            environment: 'TEST',
            locale: 'en-US',
            portalObject: options.portalObject,
            configuration: options.configuration ?? {},
        },
    );

    if (options.sessionStorage) {
        await page.addInitScript((entries: Record<string, string>) => {
            // Init scripts run in every frame, and the SDK's payment iframe is same-origin — seeding
            // there too would write the entries back after the screen has cleared them.
            if (window.top !== window) return;

            Object.entries(entries).forEach(([key, value]) => sessionStorage.setItem(key, value));
        }, options.sessionStorage);
    }

    const query = new URLSearchParams(options.query ?? {}).toString();
    await page.goto(query ? `/?${query}` : '/');

    return api;
}

export interface HostEvents {
    logs: { level: string; code: string; message: string }[];
    errors: string[];
    ready: number;
    /** The actions a screen handed back to the host, in order. */
    actions: { action: string; detail: Record<string, unknown> }[];
}

/** What the host was told: the log sink it passed, and the events the custom element dispatched. */
export function hostEvents(page: Page): Promise<HostEvents> {
    return page.evaluate((): HostEvents => {
        const events: unknown = Reflect.get(window, '__SOLVIMON_EVENTS__');
        const read = (key: string): unknown =>
            typeof events === 'object' && events !== null ? Reflect.get(events, key) : undefined;

        const logs = read('logs');
        const errors = read('errors');
        const ready = read('ready');
        const actions = read('actions');

        return {
            logs: Array.isArray(logs) ? logs : [],
            errors: Array.isArray(errors) ? errors : [],
            ready: typeof ready === 'number' ? ready : 0,
            actions: Array.isArray(actions) ? actions : [],
        };
    });
}
