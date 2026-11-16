import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import {
    ApiStatus,
    type PaymentMethod,
    type PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import CustomerOverview from './CustomerOverview.vue';
import type { CustomerOverviewConfiguration } from './CustomerOverview.types';

const {
    subscriptionsState,
    paymentMethodsState,
    mockFetchAll,
    mockFetchInitial,
    mockFetchWalletBalances,
    shippedState,
    mockCheckShipped,
    optionsState,
    preload,
} = vi.hoisted(() => ({
    subscriptionsState: {} as { items: { value: unknown[] }; error: { value: Error | null } },
    paymentMethodsState: {} as { items: { value: unknown[] }; options?: unknown },
    mockFetchAll: vi.fn(() => Promise.resolve()),
    mockFetchInitial: vi.fn(),
    mockFetchWalletBalances: vi.fn(),
    shippedState: { value: false },
    mockCheckShipped: vi.fn(),
    optionsState: { options: [] as unknown[], status: undefined as unknown },
    preload: { resolve: () => {}, mock: vi.fn() },
}));

vi.mock('@/components/payments/PaymentIntegrationForm/preloadPaymentIntegrationForms', () => ({
    preloadPaymentIntegrationForms: preload.mock,
}));

// Loaded with `import()`, which only unwraps `default` from a module that says it is one.
vi.mock('@/components/payments/PaymentMethodsModal/PaymentMethodsModal.vue', () => ({
    __esModule: true,
    default: defineComponent({
        name: 'PaymentMethodsModalStub',
        props: ['showModal', 'start', 'paymentMethodOptions', 'paymentMethods', 'customer'],
        setup: () => () => h('div', { class: 'payment-methods-modal-stub' }),
    }),
}));

vi.mock('@/composables/useCustomerPaymentMethodOptions', async () => {
    const { ref: createRef } = await import('vue');

    return {
        useCustomerPaymentMethodOptions: () => ({
            paymentMethodOptions: createRef(optionsState.options),
            apiStatus: createRef(optionsState.status),
            hasNoOptions: createRef(optionsState.status === 'DONE' && !optionsState.options.length),
            load: () => Promise.resolve(),
        }),
    };
});

vi.mock('@/composables/useHasShippedSubscription', async () => {
    const { computed } = await import('vue');

    return {
        useHasShippedSubscription: () => ({
            hasShippedSubscription: computed(() => shippedState.value),
            check: mockCheckShipped,
        }),
    };
});

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
        DEFAULT_PAYMENT_METHOD_FIRST: { orderBy: 'default', orderDirection: 'desc' },
        usePaymentMethods: (options: unknown) => {
            paymentMethodsState.options = options;
            return { ...emptyList(), items: paymentMethodsState.items };
        },
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
        props: [
            'paymentMethods',
            'isLoading',
            'configuration',
            'hasNoPaymentMethodOptions',
            'hasMorePaymentMethods',
            'onViewAll',
            'onAdd',
        ],
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

    it('hands its paymentMethods configuration to the payment methods block', async () => {
        const wrapper = await mountOverview({ paymentMethods: { showAddButton: false } });

        expect(
            wrapper.findComponent({ name: 'CustomerPaymentMethodsStub' }).props('configuration'),
        ).toEqual({ showAddButton: false });
    });

    it('shows the first three when no maxItems is given', async () => {
        const wrapper = await mountOverview();

        expect(shownPaymentMethods(wrapper).map(({ id }) => id)).toEqual(['pm_1', 'pm_2', 'pm_3']);
    });

    it.each([
        { options: [], status: ApiStatus.Done, expected: true },
        { options: [{ type: 'CARD' }], status: ApiStatus.Done, expected: false },
        { options: [], status: ApiStatus.Failed, expected: false },
    ])(
        'tells the block there is nothing to add: $expected, for $options.length options and $status',
        async ({ options, status, expected }) => {
            optionsState.options = options;
            optionsState.status = status;
            const wrapper = await mountOverview();

            expect(
                wrapper
                    .findComponent({ name: 'CustomerPaymentMethodsStub' })
                    .props('hasNoPaymentMethodOptions'),
            ).toBe(expected);
        },
    );

    it('loads the default method first', async () => {
        await mountOverview();

        expect(paymentMethodsState.options).toMatchObject({
            order: { orderBy: 'default', orderDirection: 'desc' },
        });
    });

    it('keeps the methods where they loaded when they reload, with a new one last', async () => {
        const wrapper = await mountOverview({ paymentMethods: { maxItems: 10 } });

        // A new default reloads to the top, and a method added since comes back with it.
        paymentMethodsState.items.value = [
            ...paymentMethodsOf(6).slice(2, 3),
            ...paymentMethodsOf(6).slice(5),
            ...paymentMethodsOf(2),
            ...paymentMethodsOf(5).slice(3),
        ];
        await flushPromises();

        expect(shownPaymentMethods(wrapper).map(({ id }) => id)).toEqual([
            'pm_1',
            'pm_2',
            'pm_3',
            'pm_4',
            'pm_5',
            'pm_6',
        ]);
    });

    describe('opening the payment methods modal', () => {
        const methodsBlock = (wrapper: Awaited<ReturnType<typeof mountOverview>>) =>
            wrapper.findComponent({ name: 'CustomerPaymentMethodsStub' });
        const modal = (wrapper: Awaited<ReturnType<typeof mountOverview>>) =>
            wrapper.findComponent({ name: 'PaymentMethodsModalStub' });

        // Two first-time imports of a mocked module at once can resolve to the real one.
        beforeAll(
            () => import('@/components/payments/PaymentMethodsModal/PaymentMethodsModal.vue'),
        );

        beforeEach(() => {
            optionsState.options = [{ type: 'CARD' }];
            optionsState.status = ApiStatus.Done;
            preload.mock.mockImplementation(
                () => new Promise<void>((resolve) => (preload.resolve = resolve)),
            );
        });

        it('opens on adding a method once its payment form has loaded', async () => {
            const wrapper = await mountOverview();

            void (methodsBlock(wrapper).props('onAdd') as () => Promise<void>)();
            await flushPromises();

            expect(preload.mock).toHaveBeenCalledWith([{ type: 'CARD' }]);
            expect(modal(wrapper).exists()).toBe(false);

            preload.resolve();
            await flushPromises();

            expect(modal(wrapper).props()).toMatchObject({
                showModal: true,
                start: 'ADD_PAYMENT_METHOD',
                paymentMethodOptions: [{ type: 'CARD' }],
            });
        });

        it('opens on adding once it has waited long enough for a slow form', async () => {
            vi.useFakeTimers();
            const wrapper = await mountOverview();

            void (methodsBlock(wrapper).props('onAdd') as () => Promise<void>)();
            await vi.advanceTimersByTimeAsync(2999);
            expect(modal(wrapper).exists()).toBe(false);

            await vi.advanceTimersByTimeAsync(1);
            vi.useRealTimers();
            await vi.waitFor(() => expect(modal(wrapper).exists()).toBe(true));
            expect(modal(wrapper).props('start')).toBe('ADD_PAYMENT_METHOD');
        });

        it('does not open on adding when the options turn out to offer nothing', async () => {
            optionsState.options = [];
            const wrapper = await mountOverview();

            void (methodsBlock(wrapper).props('onAdd') as () => Promise<void>)();
            preload.resolve();
            await flushPromises();

            expect(modal(wrapper).exists()).toBe(false);
        });

        it('opens on the list straight away, loading the form meanwhile', async () => {
            const wrapper = await mountOverview();

            void (methodsBlock(wrapper).props('onViewAll') as () => Promise<void>)();
            await flushPromises();

            // The preload is still out, and the modal is already on its way in.
            expect(preload.mock).toHaveBeenCalled();
            expect(wrapper.findComponent({ name: 'AsyncComponentWrapper' }).exists()).toBe(true);
            wrapper.unmount();
        });
    });

    it('shows as many as maxItems asks for', async () => {
        const wrapper = await mountOverview({ paymentMethods: { maxItems: 1 } });

        expect(shownPaymentMethods(wrapper).map(({ id }) => id)).toEqual(['pm_1']);
    });

    it.each([
        { maxItems: undefined, hasMore: true },
        { maxItems: 1, hasMore: true },
        { maxItems: 10, hasMore: false },
    ])(
        'tells the block whether it leaves some out: $hasMore with maxItems $maxItems',
        async ({ maxItems, hasMore }) => {
            const wrapper = await mountOverview({ paymentMethods: { maxItems } });

            expect(
                wrapper
                    .findComponent({ name: 'CustomerPaymentMethodsStub' })
                    .props('hasMorePaymentMethods'),
            ).toBe(hasMore);
        },
    );
});

describe('CustomerOverview — shipping addresses', () => {
    afterEach(() => {
        shippedState.value = false;
    });

    it('finds out whether the customer has a subscription that ships, starting from the loaded ones', async () => {
        await mountOverview();

        expect(mockCheckShipped).toHaveBeenCalledWith(subscriptionsState.items.value);
    });

    it('leaves the shipping addresses out for a customer without a subscription that ships', async () => {
        const wrapper = await mountOverview();

        expect(wrapper.findComponent({ name: 'CustomerShippingAddresses' }).exists()).toBe(false);
    });

    it('shows the shipping addresses below the billing information, for its customer', async () => {
        shippedState.value = true;
        const wrapper = await mountOverview();

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
