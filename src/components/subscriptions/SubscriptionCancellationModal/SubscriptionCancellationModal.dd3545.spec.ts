import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Customer } from '@solvimon/solvimon-types';
import SubscriptionCancellationModal from './SubscriptionCancellationModal.vue';
import SubscriptionsListItem from '@/components/subscriptions/SubscriptionsList/SubscriptionsListItem.vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { findPricingsByIds } from '@/utils/subscription';

vi.mock('@/composables/usePaymentMethod', async () => {
    const { ref } = await import('vue');
    return {
        usePaymentMethod: () => ({ paymentMethod: ref(), get: () => Promise.resolve() }),
    };
});

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        Modal: defineComponent({
            name: 'ModalStub',
            props: { showModal: Boolean, title: String },
            setup(props, { slots }) {
                return () => h('div', { class: 'modal' }, slots.body?.());
            },
        }),
    });
});

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: () => ({ setSubscriptionCancellation: vi.fn() }),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: vi.fn() }),
    useActionDispatchProvider: () => ({ dispatchAction: vi.fn() }),
}));

const subscriptionWithInvoiceOn = (invoiceDate: string) =>
    ({
        id: 'ppsu_1',
        name: 'Pro plan',
        status: 'ACTIVE',
        next_invoice: { invoice_date: invoiceDate },
    }) as unknown as PricingPlanSubscriptionExpanded;

const modalDate = (subscription: PricingPlanSubscriptionExpanded, customer: Customer) =>
    mount(SubscriptionCancellationModal, {
        props: { showModal: true, variant: 'CANCEL', subscription, customer },
    })
        .find('.sv-subscription-cancellation-modal__renews')
        .text()
        .replace(/^Renews\s*/, '');

const listDate = (subscription: PricingPlanSubscriptionExpanded, customer: Customer) =>
    mount(SubscriptionsListItem, {
        props: { subscription, customer, paymentMethods: [] },
    })
        .find('.sv-subscriptions-list__item-next-invoice')
        .text()
        .replace(/^Next billing date\s*/, '');

describe('DD-3545 tester: cancel modal dates match the subscriptions list', () => {
    it.each([
        ['America/New_York', '2026-09-01T02:00:00Z', '31/08/2026'],
        ['Pacific/Auckland', '2026-08-31T13:00:00Z', '01/09/2026'],
        ['UTC', '2026-08-31T23:59:59Z', '31/08/2026'],
        ['Pacific/Auckland', '2026-08-31T23:59:59Z', '01/09/2026'],
    ])('%s at %s', (timezone, invoiceDate, expected) => {
        const subscription = subscriptionWithInvoiceOn(invoiceDate);
        const customer = { id: 'cust_1', timezone } as Customer;

        expect(modalDate(subscription, customer)).toBe(expected);
        expect(listDate(subscription, customer)).toBe(expected);
    });
});

describe('DD-3545 tester: findPricingsByIds', () => {
    it('returns each id once, in first-seen order, across schedules and nested groups', () => {
        const pricing = (id: string) => ({ object_type: 'PRICING', id, name: id });
        const data = {
            pricing_plan_schedule_infos: [
                { pricing_plan_version: { pricings: [pricing('a'), pricing('b'), pricing('a')] } },
                { pricing_plan_version: { nested: { pricings: [pricing('b'), pricing('c')] } } },
            ],
        } as unknown as PricingPlanSubscriptionExpanded;

        expect(findPricingsByIds(data, ['a', 'b']).map(({ id }) => id)).toEqual(['a', 'b']);
    });
});
