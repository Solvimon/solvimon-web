import { expect, test, type Page } from '@playwright/test';
import { installApiMock, type EndpointName, type Responder } from '../support/api-mock';
import {
    aCustomer,
    aCustomerPortalObject,
    aSubscription,
    collection,
    SUBSCRIPTION_ID,
} from '../support/fixtures';
import { sharedMocks } from '../support/screen';

const acceptor = {
    id: 'paya_current',
    object_type: 'PAYMENT_ACCEPTOR',
    reference: 'main',
    name: 'Main receiving account',
    status: 'ACTIVE',
    type: 'BANK_ACCOUNT',
    bank_account: { type: 'IBAN', country: 'NL', iban: 'NL91ABNA0417164300' },
};

async function mountPaymentAcceptors(
    page: Page,
    component: 'customer-payment-acceptors' | 'subscription-payment-acceptors',
    configuration: Record<string, string>,
    mocks: Partial<Record<EndpointName, Responder>> = {},
) {
    const api = await installApiMock(page, {
        ...sharedMocks,
        customer: { body: { ...aCustomer(), roles: ['SELF_BILLING'] } },
        paymentAcceptors: { body: collection([acceptor]) },
        ...mocks,
    });
    await page.addInitScript(
        (config) => {
            const assignments: unknown[] = [];
            Object.assign(window, {
                __SOLVIMON_TEST_CONFIG__: config,
                __PAYMENT_ACCEPTOR_ASSIGNMENTS__: assignments,
            });
            document.addEventListener(
                'solvimon-subscription-payment-acceptors-changed',
                (event) => {
                    if ('detail' in event) assignments.push(event.detail);
                },
            );
        },
        { component, environment: 'TEST', portalObject: aCustomerPortalObject(), configuration },
    );
    await page.goto('/');
    return api;
}

test('mounts customer payment acceptors in read-only mode', async ({ page }) => {
    const api = await mountPaymentAcceptors(page, 'customer-payment-acceptors', {
        management: 'read-only',
    });
    const block = page.locator('solvimon-customer-payment-acceptors');

    await expect(block.getByText(acceptor.name)).toBeVisible();
    await expect(block.getByRole('button', { name: 'Manage' })).toHaveCount(0);
    expect(api.unmatchedCalls()).toEqual([]);
});

test('replaces an unavailable assignment and sends the confirmed result to the host', async ({
    page,
}) => {
    const subscription = { ...aSubscription(), variant: 'SELF_BILLING' };
    const api = await mountPaymentAcceptors(
        page,
        'subscription-payment-acceptors',
        { subscriptionId: SUBSCRIPTION_ID },
        {
            subscription: { body: { ...subscription, payment_acceptor_ids: ['paya_unavailable'] } },
            setSubscriptionPaymentAcceptors: {
                body: { ...subscription, payment_acceptor_ids: [acceptor.id] },
            },
        },
    );
    const block = page.locator('solvimon-subscription-payment-acceptors');

    await block.getByRole('button', { name: 'Manage' }).click();
    await expect(
        block.getByText('These assigned payment acceptors are unavailable.', { exact: false }),
    ).toBeVisible();
    await block.getByText(acceptor.name, { exact: true }).click();
    await block.getByRole('button', { name: 'Assign payment acceptors' }).click();

    await expect(block.locator('.sv-payment-acceptor-list__item')).toContainText(acceptor.name);
    expect(api.lastCall('setSubscriptionPaymentAcceptors')?.body).toEqual({
        payment_acceptor_ids: [acceptor.id],
    });
    expect(
        await page.evaluate(() => Reflect.get(window, '__PAYMENT_ACCEPTOR_ASSIGNMENTS__')),
    ).toEqual([
        {
            componentName: 'solvimon-subscription-payment-acceptors',
            subscriptionId: SUBSCRIPTION_ID,
            assignment: { mode: 'selected', paymentAcceptorIds: [acceptor.id] },
        },
    ]);
    expect(api.unmatchedCalls()).toEqual([]);
});
