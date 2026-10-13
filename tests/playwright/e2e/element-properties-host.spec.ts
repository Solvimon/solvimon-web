import { test, expect, type Page, type Request } from '@playwright/test';
import {
    hostEvents,
    mountSubscriptionDetails,
    subscriptionDetails,
} from '../support/subscriptionDetails';
import { checkout, mountCheckout } from '../support/checkout';
import { mountScreen, sharedMocks } from '../support/screen';
import {
    accessToken,
    aCustomer,
    aCustomerPortalObject,
    anAccessTokenResponse,
    anInvoicePreview,
    aPortalObject,
    aSubscription,
    paymentMethodOptions,
} from '../support/fixtures';

const OTHER_SUBSCRIPTION_ID = 'ppsu_other_subscription';
const OTHER_CUSTOMER_ID = 'cus_other_customer';
const OTHER_TOKEN_USER = 'other-portal-user';

const lastPathSegment = (request: Request) => new URL(request.url()).pathname.split('/').pop();

function setProperty(page: Page, tagName: string, name: string, value: unknown): Promise<void> {
    return page.evaluate(
        ({ tagName, name, value }) => {
            const element = document.querySelector(tagName);
            if (!element) throw new Error(`${tagName} is not on the page`);
            Reflect.set(element, name, value);
        },
        { tagName, name, value },
    );
}

function mergeProperty(
    page: Page,
    tagName: string,
    name: string,
    changes: Record<string, unknown>,
): Promise<void> {
    return page.evaluate(
        ({ tagName, name, changes }) => {
            const element = document.querySelector(tagName);
            if (!element) throw new Error(`${tagName} is not on the page`);
            Reflect.set(element, name, { ...Object(Reflect.get(element, name)), ...changes });
        },
        { tagName, name, changes },
    );
}

const promotionCodesOf = (body: unknown): unknown => {
    const customizations: unknown =
        typeof body === 'object' && body !== null
            ? Reflect.get(body, 'pricing_plan_schedule_customizations')
            : undefined;
    return Array.isArray(customizations)
        ? Reflect.get(Object(customizations[0]), 'promotion_codes')
        : undefined;
};

test.describe('Properties a host changes after mount', () => {
    test('a late response for the previous subscription id does not replace the new one', async ({
        page,
    }) => {
        const api = await mountSubscriptionDetails(page, {
            mocks: {
                subscription: (request) =>
                    lastPathSegment(request) === OTHER_SUBSCRIPTION_ID
                        ? { body: aSubscription({ id: OTHER_SUBSCRIPTION_ID, name: 'Team plan' }) }
                        : { body: aSubscription({ name: 'Pro plan' }), delayMs: 2500 },
            },
        });
        await api.waitForCall('subscription', 1);

        await mergeProperty(page, 'solvimon-subscription-details', 'configuration', {
            subscriptionId: OTHER_SUBSCRIPTION_ID,
        });

        await expect(subscriptionDetails(page).title).toContainText('Team plan');
        // Past the old response's delay: it must not take the screen back.
        await page.waitForTimeout(3000);
        await expect(subscriptionDetails(page).title).toContainText('Team plan');
        await expect(subscriptionDetails(page).title).not.toContainText('Pro plan');
        expect(api.unmatchedCalls()).toEqual([]);
    });

    test('no request goes out with the previous access token once the token changes', async ({
        page,
    }) => {
        const api = await mountSubscriptionDetails(page, {
            mocks: {
                accessToken: (request) => ({
                    body: {
                        ...anAccessTokenResponse(),
                        access_token: `${accessToken()}${
                            (request.postData() ?? '').includes(OTHER_TOKEN_USER) ? 'NEW' : 'OLD'
                        }`,
                    },
                }),
                customer: (request) => ({
                    body: aCustomer({ id: lastPathSegment(request) }),
                    delayMs: 300,
                }),
            },
        });
        await expect(subscriptionDetails(page).title).toBeVisible();

        await mergeProperty(page, 'solvimon-subscription-details', 'portalObject', {
            customer_id: OTHER_CUSTOMER_ID,
            token: Buffer.from(`${OTHER_TOKEN_USER}.purl_other`).toString('base64'),
        });

        const exchange = await api.waitForCall('accessToken', 2);
        await expect(subscriptionDetails(page).title).toBeVisible();
        await page.waitForTimeout(1000);

        const dataCalls = (
            ['customer', 'subscription', 'paymentMethods', 'walletBalances'] as const
        )
            .flatMap((name) => api.calls(name))
            .filter(({ order }) => order > exchange.order);

        expect(dataCalls.length).toBeGreaterThan(0);
        dataCalls.forEach(({ headers, url }) => {
            expect(headers.authorization, url).toMatch(/NEW$/);
        });
        expect(api.unmatchedCalls()).toEqual([]);
    });

    test('a new portal object with the same token keeps what the customer typed', async ({
        page,
    }) => {
        const api = await mountCheckout(page);
        await expect(checkout(page).email).toBeVisible();
        await checkout(page).email.fill('typed@example.com');

        // A host re-rendering hands the element an equal object, not the same one.
        await mergeProperty(page, 'solvimon-checkout', 'portalObject', {});
        await page.waitForTimeout(500);

        await expect(checkout(page).email).toHaveValue('typed@example.com');
        expect(api.calls('accessToken')).toHaveLength(1);
        expect(api.calls('subscription')).toHaveLength(1);
    });

    test('a new environment signs in again against that environment', async ({ page }) => {
        const api = await mountSubscriptionDetails(page);
        await expect(subscriptionDetails(page).title).toBeVisible();
        const first = api.calls('subscription').map(({ url }) => new URL(url).host);

        await setProperty(page, 'solvimon-subscription-details', 'environment', 'LIVE');

        await api.waitForCall('accessToken', 2);
        await api.waitForCall('subscription', 2);
        const hosts = api.calls('subscription').map(({ url }) => new URL(url).host);
        expect(hosts[0]).toBe(first[0]);
        expect(hosts[1]).toBe('api.solvimon.com');
        await expect(subscriptionDetails(page).title).toBeVisible();
    });

    test('a coupon code set before the subscription has loaded is applied', async ({ page }) => {
        const api = await mountCheckout(page, {
            mocks: { subscription: { body: aSubscription(), delayMs: 2000 } },
        });
        await api.waitForCall('subscription', 1);

        await mergeProperty(page, 'solvimon-checkout', 'configuration', { couponCode: 'LATE' });

        await expect
            .poll(() => promotionCodesOf(api.lastCall('invoicePreview')?.body))
            .toEqual(['LATE']);
        expect(api.unmatchedCalls()).toEqual([]);
    });

    test('a coupon code set after the subscription has loaded is not applied (documented)', async ({
        page,
    }) => {
        const api = await mountCheckout(page);
        await expect(checkout(page).orderSummary).toBeVisible();

        await mergeProperty(page, 'solvimon-checkout', 'configuration', { couponCode: 'AFTER' });
        await page.waitForTimeout(1000);

        api.calls('invoicePreview').forEach(({ body }) =>
            expect(promotionCodesOf(body)).toBeUndefined(),
        );
    });

    test('an unsupported locale renders en-US and warns once', async ({ page }) => {
        await mountSubscriptionDetails(page);
        await expect(subscriptionDetails(page).title).toBeVisible();

        await setProperty(page, 'solvimon-subscription-details', 'locale', 'nl');
        await expect
            .poll(async () =>
                (await hostEvents(page)).logs.filter(({ code }) => code === 'UNSUPPORTED_LOCALE'),
            )
            .toHaveLength(1);

        // Anything else that re-renders the element must not warn again.
        await mergeProperty(page, 'solvimon-subscription-details', 'configuration', {});
        await setProperty(page, 'solvimon-subscription-details', 'experimentalFeatures', []);
        await page.waitForTimeout(500);

        const warnings = (await hostEvents(page)).logs.filter(
            ({ code }) => code === 'UNSUPPORTED_LOCALE',
        );
        expect(warnings).toHaveLength(1);
        await expect(subscriptionDetails(page).title).toBeVisible();
    });
});

test.describe('How a host puts the element on the page', () => {
    /** The URL the test app loaded the SDK's core from, so an entry can be imported beside it. */
    const sdkDistUrl = (page: Page) =>
        page.evaluate(() => {
            const core = performance
                .getEntriesByType('resource')
                .map(({ name }) => name)
                .find((name) => /\/dist\/core\/index\.mjs/.test(name));
            if (!core) throw new Error('core not loaded');
            return core.replace(/core\/index\.mjs.*$/, '');
        });

    const checkoutMocks = {
        ...sharedMocks,
        subscription: { body: aSubscription() },
        invoicePreview: { body: anInvoicePreview({ total: '20.00' }) },
        paymentMethodOptions: { body: paymentMethodOptions({}) },
        geoLocation: { body: { ip: '203.0.113.1', country: 'NL' } },
    };

    test('createScreen mounts the checkout under the tag the host defined it as', async ({
        page,
    }) => {
        // Something cheap is mounted first so the app has loaded the core; the checkout entry is
        // then defined under a custom name before the core is asked for a checkout.
        await mountScreen(
            page,
            'customer-overview',
            { portalObject: aCustomerPortalObject({ status: 'REVOKED' }) },
            checkoutMocks,
        );
        const base = await sdkDistUrl(page);

        const result = await page.evaluate(
            async ({ base, portalObject }) => {
                const entry = await import(`${base}screens/Checkout/Checkout.mjs`);
                const first = entry.defineSolvimonCheckout('acme-checkout');
                const second = entry.defineSolvimonCheckout('other-checkout');
                const core = await import(`${base}core/index.mjs`);
                const container = document.createElement('div');
                document.body.append(container);
                core.createSolvimonCore({ environment: 'TEST' }).createScreen('checkout', {
                    container,
                    portalObject,
                });
                await new Promise((resolve) => setTimeout(resolve, 500));
                return {
                    first,
                    second,
                    tag: container.firstElementChild?.tagName.toLowerCase(),
                    canonical: Boolean(customElements.get('solvimon-checkout')),
                    other: Boolean(customElements.get('other-checkout')),
                };
            },
            { base, portalObject: aPortalObject() },
        );

        expect(result).toEqual({
            first: 'acme-checkout',
            second: 'acme-checkout',
            tag: 'acme-checkout',
            canonical: false,
            other: false,
        });
        await expect(page.locator('acme-checkout .sv-checkout__title')).toBeVisible();
    });

    test('an element connected before its portal object is set renders once it is set', async ({
        page,
    }) => {
        // The README's React example: JSX puts the element in the DOM, and the effect that sets
        // `portalObject` runs after it is connected.
        await mountScreen(
            page,
            'customer-overview',
            { portalObject: aCustomerPortalObject({ status: 'REVOKED' }) },
            checkoutMocks,
        );
        const base = await sdkDistUrl(page);

        await page.evaluate(
            async ({ base, portalObject }) => {
                const entry = await import(`${base}screens/Checkout/Checkout.mjs`);
                entry.defineSolvimonCheckout();
                const element = document.createElement('solvimon-checkout');
                element.setAttribute('environment', 'TEST');
                document.body.append(element);
                await new Promise((resolve) => setTimeout(resolve, 50));
                Object.assign(element, { portalObject });
            },
            { base, portalObject: aPortalObject() },
        );

        await expect(page.locator('solvimon-checkout .sv-checkout__title')).toBeVisible();
    });
});

test.describe('Portal checks before the token exchange', () => {
    /**
     * The portal check runs above `AuthProvider`, so a revoked portal's token is never exchanged,
     * and identity refusing it cannot keep the checkout from its "not available" notice.
     */
    test('a revoked checkout shows its notice even when identity refuses the token', async ({
        page,
    }) => {
        const api = await mountCheckout(page, {
            portalObject: aPortalObject({ status: 'REVOKED' }),
            mocks: { accessToken: { status: 401, body: { message: 'Portal url revoked' } } },
        });

        await expect(checkout(page).unavailable).toBeVisible({ timeout: 5000 });
        expect(api.calls('subscription')).toEqual([]);
    });

    test('a wrong-type portal makes no call, not even the token exchange', async ({ page }) => {
        const api = await mountSubscriptionDetails(page, {
            portalObject: aCustomerPortalObject({ type: 'INIT_PRICING_PLAN_SUBSCRIPTION' }),
        });

        await expect
            .poll(async () => (await hostEvents(page)).logs.map(({ code }) => code))
            .toContain('PORTAL_TYPE_NOT_ALLOWED');
        await page.waitForTimeout(1000);
        expect(api.calls('accessToken')).toHaveLength(0);
        (['customer', 'subscription', 'paymentMethods', 'walletBalances'] as const).forEach(
            (name) => expect(api.calls(name)).toEqual([]),
        );
        expect(api.unmatchedCalls()).toEqual([]);
    });
});
