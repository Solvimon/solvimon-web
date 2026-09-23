import type { Page } from '@playwright/test';
import { installApiMock, type ApiMock, type EndpointName, type Responder } from './api-mock';
import {
    anAccessTokenResponse,
    anInvoicePreview,
    aPortalObject,
    aSubscription,
    billingPeriodKey,
    MONTHLY,
    paymentMethodOptions,
    type BillingPeriod,
    type Json,
} from './fixtures';
import type { StripeStubConfig } from './stripe-stub';

/**
 * What a working checkout answers with, before a test overrides the part it is about. The amounts
 * are per billing period, so a plan with more than one is priced differently for each without the
 * test having to hand-write a responder.
 */
const DEFAULT_PERIOD_TOTALS: Record<string, string> = {
    [billingPeriodKey(MONTHLY)]: '20.00',
    'YEAR:1': '200.00',
};

export interface MountOptions {
    portalObject?: Json;
    configuration?: {
        email?: string;
        countryCode?: string;
        enabledPricingIds?: string[];
        couponCode?: string;
    };
    /** Overrides the subscription the screen loads; defaults to a plain monthly plan. */
    subscription?: Json;
    /** Total per billing period key (`MONTH:1`), for the preview the default responder returns. */
    periodTotals?: Record<string, string>;
    /** The plan bills a trial first — the screen then reads `first_invoice` as the trial invoice. */
    trial?: boolean;
    /** Answers the preview with a usage-based invoice. */
    usageBased?: boolean;
    gateways?: ('STRIPE' | 'ADYEN')[];
    /** Per-endpoint overrides, applied on top of the defaults. */
    mocks?: Partial<Record<EndpointName, Responder>>;
    /** How the stubbed Stripe.js behaves. */
    stripe?: Partial<StripeStubConfig>;
    /** Extra query parameters, for the redirect-return cases. */
    query?: Record<string, string>;
    /** Seeded before the app boots. */
    sessionStorage?: Record<string, string>;
}

/** The billing period a preview request is asking about, which decides what it is answered with. */
function requestedBillingPeriod(body: unknown): BillingPeriod | undefined {
    if (typeof body !== 'object' || body === null) return undefined;

    const customizations = Reflect.get(body, 'pricing_plan_schedule_customizations');
    if (!Array.isArray(customizations)) return undefined;

    for (const customization of customizations) {
        const period = Reflect.get(Object(customization), 'billing_period');
        if (period) return period;
    }

    return undefined;
}

function defaultMocks(options: MountOptions): Partial<Record<EndpointName, Responder>> {
    const periodTotals = { ...DEFAULT_PERIOD_TOTALS, ...options.periodTotals };
    const subscription = options.subscription ?? aSubscription();

    return {
        accessToken: { body: anAccessTokenResponse() },
        refreshToken: { body: anAccessTokenResponse() },
        subscription: { body: subscription },
        invoicePreview: (request) => {
            const period = requestedBillingPeriod(request.postDataJSON());
            const total =
                (period && periodTotals[billingPeriodKey(period)]) ?? periodTotals['MONTH:1'];

            return {
                body: anInvoicePreview({
                    total,
                    billingPeriod: period ?? MONTHLY,
                    usageBased: options.usageBased,
                    ...(options.trial ? { trialTotal: '0.00' } : {}),
                }),
            };
        },
        paymentMethodOptions: { body: paymentMethodOptions({ gateways: options.gateways }) },
        geoLocation: { body: { ip: '203.0.113.1', country: 'NL' } },
    };
}

/**
 * Installs the mocks, hands the test app its scenario and navigates. The app reads
 * `window.__SOLVIMON_TEST_CONFIG__`, which an init script puts in place before it boots.
 */
export async function mountCheckout(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await installApiMock(page, { ...defaultMocks(options), ...options.mocks });

    if (options.stripe) {
        api.stripe(options.stripe);
    }

    await page.addInitScript(
        (config) => {
            Object.assign(window, { __SOLVIMON_TEST_CONFIG__: config });
        },
        {
            // The published environment, so nothing can resolve to internal infrastructure even if
            // a request were ever to escape the mocks.
            environment: 'TEST',
            locale: 'en-US',
            portalObject: options.portalObject ?? aPortalObject(),
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

/** The parts of the screen the specs reach for, named once so a class change lands in one place. */
export function checkout(page: Page) {
    return {
        screen: page.locator('.sv-checkout'),
        unavailable: page.locator('.sv-checkout--error'),
        paid: page.locator('.sv-checkout--paid'),
        title: page.locator('.sv-checkout__title'),
        orderSummary: page.locator('.sv-checkout__order-summary'),
        completedCard: page.locator('.sv-checkout__completed-payment'),
        planCustomization: page.locator('.sv-checkout__plan-customization'),
        seats: page.locator('.sv-plan-customization__seats input[type="number"]').first(),
        form: page.locator('.sv-checkout__customer-form'),
        /** The toggle's own input is visually hidden, so the label is what a customer clicks. */
        companyPurchase: page.getByText('I am purchasing on behalf of a company'),
        email: page.locator('input[name="email"]'),
        country: page.locator('input[name="country"]'),
        legalName: page.locator('input[name="legal_name"]'),
        vatNumber: page.locator('input[name="vat_number"]'),
        addressLine1: page.locator('input[name="address_line_1"]'),
        postalCode: page.locator('input[name="postal_code"]'),
        city: page.locator('input[name="city"]'),
        state: page.locator('input[name="state"]'),
        paymentMethods: page.locator('.sv-checkout__payment-methods'),
        paymentForm: page.locator('.sv-checkout__payment-form'),
        paymentMethodsEmpty: page.locator('.sv-checkout__payment-methods-empty'),
        paymentMethodsError: page.locator('.sv-checkout__payment-methods-error'),
        paymentMethodsRetry: page.locator('.sv-checkout__payment-methods-retry'),
        promotionCode: page.locator('.sv-checkout__promotion-code'),
        promotionError: page.locator('.sv-checkout__promotion-error'),
        submit: page.locator('.sv-checkout__submit'),
        /** The stubbed Stripe payment element, which lives in the SDK's own iframe. */
        stripeElement: page
            .frameLocator('iframe')
            .locator('[data-testid="stripe-payment-element"]'),
    };
}

export interface HostEvents {
    logs: { level: string; code: string; message: string }[];
    errors: string[];
    ready: number;
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

        return {
            logs: Array.isArray(logs) ? logs : [],
            errors: Array.isArray(errors) ? errors : [],
            ready: typeof ready === 'number' ? ready : 0,
        };
    });
}
