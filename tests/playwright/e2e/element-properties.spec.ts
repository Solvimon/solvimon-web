import { test, expect, type Page, type Request } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    hostEvents,
    mountSubscriptionDetails,
    subscriptionDetails,
} from '../support/subscriptionDetails';
import { mountCustomerOverview } from '../support/customerOverview';
import {
    aCustomer,
    aCustomerPortalObject,
    aPortalObject,
    aSubscription,
    CUSTOMER_ID,
    SUBSCRIPTION_ID,
} from '../support/fixtures';

/**
 * What a host can do to an element after it has mounted, done the way a host does it: by setting
 * properties on the custom element from plain JavaScript.
 */

const OTHER_SUBSCRIPTION_ID = 'ppsu_other_subscription';
const OTHER_CUSTOMER_ID = 'cus_other_customer';

const lastPathSegment = (request: Request) => new URL(request.url()).pathname.split('/').pop();

/** Replaces one of the element's object properties with a copy that has `changes` merged in. */
function updateProperty(
    page: Page,
    tagName: string,
    name: string,
    changes: Record<string, unknown>,
): Promise<void> {
    return page.evaluate(
        ({ tagName, name, changes }) => {
            const element = document.querySelector(tagName);
            if (!element) throw new Error(`${tagName} is not on the page`);

            const current: unknown = Reflect.get(element, name);
            Reflect.set(element, name, { ...Object(current), ...changes });
        },
        { tagName, name, changes },
    );
}

const codesLogged = async (page: Page) => (await hostEvents(page)).logs.map(({ code }) => code);

test.describe('Element properties', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test.describe('changed after mount', () => {
        test('a new subscription id loads that subscription', async ({ page }) => {
            api = await mountSubscriptionDetails(page, {
                mocks: {
                    subscription: (request) =>
                        lastPathSegment(request) === OTHER_SUBSCRIPTION_ID
                            ? {
                                  body: aSubscription({
                                      id: OTHER_SUBSCRIPTION_ID,
                                      name: 'Team plan',
                                  }),
                              }
                            : { body: aSubscription({ name: 'Pro plan' }) },
                },
            });
            await expect(subscriptionDetails(page).title).toContainText('Pro plan');

            await updateProperty(page, 'solvimon-subscription-details', 'configuration', {
                subscriptionId: OTHER_SUBSCRIPTION_ID,
            });

            await expect(subscriptionDetails(page).title).toContainText('Team plan');
            expect(api.calls('subscription').map(({ url }) => new URL(url).pathname)).toEqual([
                `/v1/portal/pricing-plan-subscriptions/${SUBSCRIPTION_ID}`,
                `/v1/portal/pricing-plan-subscriptions/${OTHER_SUBSCRIPTION_ID}`,
            ]);
        });

        test('a portal object with another token signs in again and loads its customer', async ({
            page,
        }) => {
            api = await mountSubscriptionDetails(page, {
                mocks: {
                    customer: (request) => ({
                        body: aCustomer({ id: lastPathSegment(request) ?? CUSTOMER_ID }),
                    }),
                },
            });
            await expect(subscriptionDetails(page).title).toBeVisible();
            expect(api.calls('accessToken')).toHaveLength(1);

            await updateProperty(page, 'solvimon-subscription-details', 'portalObject', {
                customer_id: OTHER_CUSTOMER_ID,
                token: Buffer.from('other-portal-user.purl_other').toString('base64'),
            });

            await api.waitForCall('accessToken', 2);
            await expect
                .poll(() => api.calls('customer').map(({ url }) => new URL(url).pathname))
                .toEqual([
                    `/v1/portal/customers/${CUSTOMER_ID}`,
                    `/v1/portal/customers/${OTHER_CUSTOMER_ID}`,
                ]);
            await expect(subscriptionDetails(page).title).toBeVisible();
        });
    });

    test.describe('portal checks', () => {
        test('an element given a portal of another type renders nothing and says why', async ({
            page,
        }) => {
            api = await mountCustomerOverview(page, { portalObject: aPortalObject() });

            await expect.poll(() => codesLogged(page)).toContain('PORTAL_TYPE_NOT_ALLOWED');
            await expect(page.locator('solvimon-customer-overview')).toBeAttached();
            expect(api.calls('customer')).toEqual([]);
        });

        test('an element given a revoked portal renders nothing and loads nothing', async ({
            page,
        }) => {
            api = await mountSubscriptionDetails(page, {
                portalObject: aCustomerPortalObject({ status: 'REVOKED' }),
            });

            await expect.poll(() => codesLogged(page)).toContain('RESOURCE_REVOKED');
            await expect(subscriptionDetails(page).screen).toHaveCount(0);
            expect(api.calls('subscription')).toEqual([]);
        });
    });
});
