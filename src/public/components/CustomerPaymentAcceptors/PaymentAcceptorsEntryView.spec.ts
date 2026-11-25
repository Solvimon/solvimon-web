import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import PaymentAcceptorsEntryView from './PaymentAcceptorsEntryView.vue';

const { state } = vi.hoisted(() => ({
    state: {
        isLoading: false,
        customer: undefined as unknown,
        customerError: null as Error | null,
        subscription: undefined as unknown,
        subscriptionError: null as Error | null,
    },
}));

vi.mock('@/composables/useCustomer', () => ({
    useCustomer: () => ({
        customer: ref(state.customer),
        get: { execute: () => Promise.resolve(), error: ref(state.customerError) },
    }),
}));

vi.mock('@/composables/useSubscription', () => ({
    useSubscription: () => ({
        subscription: ref(state.subscription),
        error: ref(state.subscriptionError),
        get: () => Promise.resolve(),
    }),
}));

vi.mock('@/composables/useLoadInitialData', () => ({
    useLoadInitialData: () => ({ isLoading: ref(state.isLoading) }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        ErrorNotification: defineComponent({
            name: 'ErrorNotification',
            props: { title: String },
            setup: (props) => () => h('div', props.title),
        }),
    });
});

vi.mock('@/components/shared/LoadFailedNotice.vue', () => ({
    default: defineComponent({ name: 'LoadFailedNotice', setup: () => () => h('div') }),
}));

vi.mock('./CustomerPaymentAcceptors.vue', () => ({
    default: defineComponent({
        name: 'CustomerPaymentAcceptors',
        props: { customerId: String, subscription: Object, maxItems: Number, management: String },
        setup: () => () => h('div'),
    }),
}));

const selfBilling = { id: 'cust_1', roles: ['SELF_BILLING'] };
const selfBillingSubscription = { id: 'ppsu_1', customer_id: 'cust_1', variant: 'SELF_BILLING' };

const mountView = (props: { subscriptionId?: string } = {}) =>
    mount(PaymentAcceptorsEntryView, {
        props: { customerId: 'cust_1', configuration: { management: 'inline' }, ...props },
    });

const block = (wrapper: ReturnType<typeof mountView>) =>
    wrapper.findComponent({ name: 'CustomerPaymentAcceptors' });

describe('PaymentAcceptorsEntryView', () => {
    beforeEach(() => {
        Object.assign(state, {
            isLoading: false,
            customer: selfBilling,
            customerError: null,
            subscription: undefined,
            subscriptionError: null,
        });
    });

    it('shows a self-billing customer their payment acceptors', () => {
        const wrapper = mountView();

        expect(block(wrapper).props()).toMatchObject({
            customerId: 'cust_1',
            management: 'inline',
        });
    });

    it('says payment acceptors are unavailable to a customer without the self-billing role', () => {
        state.customer = { id: 'cust_1', roles: [] };
        const wrapper = mountView();

        expect(block(wrapper).exists()).toBe(false);
        expect(wrapper.find('.sv-error').exists()).toBe(true);
    });

    it("shows a self-billing subscription's payment acceptors", () => {
        state.subscription = selfBillingSubscription;
        const wrapper = mountView({ subscriptionId: 'ppsu_1' });

        expect(block(wrapper).props('subscription')).toEqual(selfBillingSubscription);
    });

    it('shows them read-only to a customer who lost the self-billing role', () => {
        state.customer = { id: 'cust_1', roles: [] };
        state.subscription = selfBillingSubscription;
        const wrapper = mountView({ subscriptionId: 'ppsu_1' });

        expect(block(wrapper).props('management')).toBe('read-only');
    });

    it.each([
        ['of another customer', { ...selfBillingSubscription, customer_id: 'cust_2' }],
        ['that is not self-billing', { ...selfBillingSubscription, variant: 'FORWARD_BILLING' }],
    ])('says payment acceptors are unavailable for a subscription %s', (_, subscription) => {
        state.subscription = subscription;
        const wrapper = mountView({ subscriptionId: 'ppsu_1' });

        expect(block(wrapper).exists()).toBe(false);
        expect(wrapper.find('.sv-error').exists()).toBe(true);
    });

    it.each([
        ['the customer', { customerError: new Error('customer') }],
        ['the subscription', { subscriptionError: new Error('subscription') }],
    ])('says so when %s cannot be loaded', (_, failure) => {
        Object.assign(state, { subscription: selfBillingSubscription, ...failure });
        const wrapper = mountView({ subscriptionId: 'ppsu_1' });

        expect(wrapper.findComponent({ name: 'LoadFailedNotice' }).exists()).toBe(true);
        expect(block(wrapper).exists()).toBe(false);
    });

    it('shows a placeholder while loading', () => {
        state.isLoading = true;
        const wrapper = mountView();

        expect(wrapper.find('.sv-loading').exists()).toBe(true);
        expect(block(wrapper).exists()).toBe(false);
    });
});
