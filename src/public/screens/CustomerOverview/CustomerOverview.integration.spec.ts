import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type { PaymentMethod, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import CustomerOverview from './CustomerOverview.vue';
import type { CustomerOverviewConfiguration } from './CustomerOverview.types';

const {
    subscriptionsState,
    paymentMethodsState,
    mockFetchAll,
    mockFetchInitial,
    mockFetchWalletBalances,
} = vi.hoisted(() => ({
    subscriptionsState: {} as { items: { value: unknown[] }; error: { value: Error | null } },
    paymentMethodsState: {} as { items: { value: unknown[] } },
    mockFetchAll: vi.fn(),
    mockFetchInitial: vi.fn(),
    mockFetchWalletBalances: vi.fn(),
}));

vi.mock('@/composables/useSubscriptionsList', async () => {
    const { ref: createRef } = await import('vue');

    subscriptionsState.items = createRef<unknown[]>([]);
    subscriptionsState.error = createRef<Error | null>(null);

    return {
        useSubscriptionsList: () => ({
            items: subscriptionsState.items,
            fetchAll: mockFetchAll,
            fetchInitial: mockFetchInitial,
            fetchMore: vi.fn(),
            hasNextBatch: createRef(false),
            isPending: createRef(false),
            error: subscriptionsState.error,
        }),
    };
});

const emptyList = () => ({
    items: ref([]),
    fetchAll: vi.fn(),
    fetchInitial: vi.fn(),
    fetchMore: vi.fn(),
    hasNextBatch: ref(false),
    isPending: ref(false),
    error: ref(null),
});

vi.mock('@/composables/useInvoicesList', () => ({ useInvoicesList: () => emptyList() }));

vi.mock('@/composables/usePaymentMethods', async () => {
    const { ref: createRef } = await import('vue');

    paymentMethodsState.items = createRef<unknown[]>([]);

    return {
        usePaymentMethods: () => ({ ...emptyList(), items: paymentMethodsState.items }),
    };
});

vi.mock('@/composables/useCustomer', () => ({
    useCustomer: () => ({
        customer: ref({ id: 'cust_1' }),
        get: { execute: vi.fn().mockResolvedValue(undefined) },
    }),
}));

vi.mock('@/composables/useCustomerWalletBalances', () => ({
    useCustomerWalletBalances: () => ({
        walletBalances: ref({ wallet_balances: [] }),
        apiStatus: ref('DONE'),
        fetch: mockFetchWalletBalances,
    }),
}));

vi.mock('@/components/providers/PortalProvider/composables/usePortal', () => ({
    usePortal: () => ref({ customer_id: 'cust_1' }),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/public/components/SubscriptionsList/SubscriptionsList.vue', () => ({
    default: defineComponent({
        name: 'SubscriptionsListStub',
        props: ['subscriptions', 'customer', 'paymentMethods', 'isLoading', 'hasError'],
        setup: () => () => h('div'),
    }),
}));
vi.mock('@/public/components/InvoicesList/InvoicesList.vue', () => ({
    default: defineComponent({
        name: 'InvoicesListStub',
        props: ['invoices', 'hasMoreItems', 'isLoading'],
        setup: () => () => h('div'),
    }),
}));
vi.mock('@/public/components/CustomerWalletBalances/CustomerWalletBalances.vue', () => ({
    default: defineComponent({
        name: 'CustomerWalletBalancesStub',
        props: ['walletBalances', 'isLoading', 'hasError', 'subscriptions', 'paymentMethods'],
        setup: () => () => h('div'),
    }),
}));
vi.mock('@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.vue', () => ({
    default: defineComponent({
        name: 'CustomerPaymentMethodsStub',
        props: ['paymentMethods', 'isLoading', 'configuration'],
        setup: () => () => h('div'),
    }),
}));
vi.mock('@/public/components/BillingInformation/BillingInformation.vue', () => ({
    default: defineComponent({
        name: 'BillingInformationStub',
        props: ['customer', 'isLoading'],
        setup: () => () => h('div'),
    }),
}));

// Loaded with `import()`, which only unwraps `default` from a module that says it is one.
vi.mock('@/public/components/CustomerShippingAddresses/CustomerShippingAddresses.vue', () => ({
    __esModule: true,
    default: defineComponent({
        name: 'CustomerShippingAddresses',
        props: { customerId: String, customer: Object, isLoading: Boolean },
        setup: () => () => h('div', { class: 'shipping-addresses-stub' }),
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const subscriptionsOf = (count: number) =>
    Array.from(
        { length: count },
        (_, index) =>
            ({
                id: `ppsu_${index + 1}`,
                name: `Subscription ${index + 1}`,
                pricing_plan_schedule_infos: [{ id: `ppsc_${index + 1}` }],
            }) as unknown as PricingPlanSubscriptionExpanded,
    );

const paymentMethodsOf = (count: number) =>
    Array.from(
        { length: count },
        (_, index) => ({ id: `pm_${index + 1}` }) as unknown as PaymentMethod,
    );

const mountOverview = async (configuration?: CustomerOverviewConfiguration) => {
    const wrapper = mount(CustomerOverview, { props: { configuration } });
    await flushPromises();

    return wrapper;
};

const shownPaymentMethods = (wrapper: Awaited<ReturnType<typeof mountOverview>>) =>
    wrapper.findComponent({ name: 'CustomerPaymentMethodsStub' }).props('paymentMethods') as {
        id: string;
    }[];

describe('CustomerOverview — subscriptions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        subscriptionsState.error.value = null;
        subscriptionsState.items.value = subscriptionsOf(5);
        paymentMethodsState.items.value = paymentMethodsOf(5);
    });

    it('loads every active subscription rather than the first page', async () => {
        await mountOverview();

        expect(mockFetchAll).toHaveBeenCalled();
        expect(mockFetchInitial).not.toHaveBeenCalled();
    });

    it('tells the list when the subscriptions could not be loaded', async () => {
        subscriptionsState.error.value = new Error('Network error');

        const wrapper = await mountOverview();

        expect(wrapper.findComponent({ name: 'SubscriptionsListStub' }).props('hasError')).toBe(
            true,
        );
    });

    it('shows only the first two in the list', async () => {
        const wrapper = await mountOverview();

        const shown = wrapper
            .findComponent({ name: 'SubscriptionsListStub' })
            .props('subscriptions') as { id: string }[];

        expect(shown.map(({ id }) => id)).toEqual(['ppsu_1', 'ppsu_2']);
    });

    it('hands the wallet balances every subscription, not just the shown ones', async () => {
        const wrapper = await mountOverview();

        const handed = wrapper
            .findComponent({ name: 'CustomerWalletBalancesStub' })
            .props('subscriptions') as { id: string }[];

        expect(handed).toHaveLength(5);
    });
    describe('reloading the wallet balances', () => {
        it.each([['top-up-charged'], ['auto-top-up-saved'], ['auto-top-up-cancelled']])(
            'reads the balance again after %s',
            async (event) => {
                const wrapper = await mountOverview();
                mockFetchWalletBalances.mockClear();

                wrapper.findComponent({ name: 'CustomerWalletBalancesStub' }).vm.$emit(event);

                expect(mockFetchWalletBalances).toHaveBeenCalledTimes(1);
            },
        );
    });
});

describe('CustomerOverview — payment methods', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        subscriptionsState.items.value = subscriptionsOf(5);
        paymentMethodsState.items.value = paymentMethodsOf(5);
    });

    it('hands its configuration to the payment methods block', async () => {
        const wrapper = await mountOverview({ showAddButton: false });

        expect(
            wrapper.findComponent({ name: 'CustomerPaymentMethodsStub' }).props('configuration'),
        ).toEqual({ showAddButton: false });
    });

    it('shows the first three when no maxItems is given', async () => {
        const wrapper = await mountOverview();

        expect(shownPaymentMethods(wrapper).map(({ id }) => id)).toEqual(['pm_1', 'pm_2', 'pm_3']);
    });

    it('shows as many as maxItems asks for', async () => {
        const wrapper = await mountOverview({ maxItems: 1 });

        expect(shownPaymentMethods(wrapper).map(({ id }) => id)).toEqual(['pm_1']);
    });
});

describe('CustomerOverview — shipping addresses', () => {
    it('leaves the shipping addresses out unless the host asks for them', async () => {
        const wrapper = await mountOverview();

        expect(wrapper.findComponent({ name: 'CustomerShippingAddresses' }).exists()).toBe(false);
    });

    it('shows the shipping addresses below the billing information, for its customer', async () => {
        const wrapper = await mountOverview({ showShippingAddresses: true });

        const aside = wrapper.html();
        const shipping = wrapper.findComponent({ name: 'CustomerShippingAddresses' });

        expect(shipping.exists()).toBe(true);
        // The portal's customer id, so the addresses load alongside the customer, not after it.
        expect(shipping.props('customerId')).toBe('cust_1');
        expect(shipping.props('customer')).toEqual(
            wrapper.findComponent({ name: 'BillingInformationStub' }).props('customer'),
        );
        expect(aside.indexOf('shipping-addresses-stub')).toBeGreaterThan(
            aside.indexOf('sv-customer-overview__billing-information'),
        );
    });
});
