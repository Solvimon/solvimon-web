import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import CustomerOverview from './CustomerOverview.vue';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { subscriptionsState, mockFetchAll, mockFetchInitial } = vi.hoisted(() => ({
    subscriptionsState: {} as { items: { value: unknown[] } },
    mockFetchAll: vi.fn(),
    mockFetchInitial: vi.fn(),
}));

vi.mock('@/composables/useSubscriptionsList', async () => {
    const { ref: createRef } = await import('vue');

    subscriptionsState.items = createRef<unknown[]>([]);

    return {
        useSubscriptionsList: () => ({
            items: subscriptionsState.items,
            fetchAll: mockFetchAll,
            fetchInitial: mockFetchInitial,
            fetchMore: vi.fn(),
            hasNextBatch: createRef(false),
            isPending: createRef(false),
            error: createRef(null),
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
vi.mock('@/composables/usePaymentMethods', () => ({ usePaymentMethods: () => emptyList() }));

vi.mock('@/composables/useCustomer', () => ({
    useCustomer: () => ({
        customer: ref({ id: 'cust_1' }),
        get: { execute: vi.fn().mockResolvedValue(undefined) },
    }),
}));

vi.mock('@/composables/useCustomerPaymentMethodOptions', () => ({
    useCustomerPaymentMethodOptions: () => ({ fetch: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('@/composables/useCustomerWalletBalances', () => ({
    useCustomerWalletBalances: () => ({
        walletBalances: ref({ wallet_balances: [] }),
        apiStatus: ref('DONE'),
        fetch: vi.fn().mockResolvedValue(undefined),
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
        props: ['subscriptions', 'customer', 'paymentMethods', 'isLoading'],
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
        props: ['walletBalances', 'isLoading', 'hasError'],
        setup: () => () => h('div'),
    }),
}));
vi.mock('@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.vue', () => ({
    default: defineComponent({
        name: 'CustomerPaymentMethodsStub',
        props: ['paymentMethods', 'isLoading'],
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
vi.mock('@/components/wallets/TopUpModal/TopUpModal.vue', () => ({
    default: defineComponent({
        name: 'TopUpModalStub',
        props: ['showModal', 'paymentMethods', 'customer', 'selectedBalanceItem', 'subscriptions'],
        setup: () => () => h('div'),
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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

const mountOverview = async () => {
    const wrapper = mount(CustomerOverview, { props: { isLoading: false } });
    await flushPromises();

    return wrapper;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomerOverview — subscriptions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        subscriptionsState.items.value = subscriptionsOf(5);
    });

    it('loads every active subscription rather than the first page', async () => {
        await mountOverview();

        expect(mockFetchAll).toHaveBeenCalled();
        expect(mockFetchInitial).not.toHaveBeenCalled();
    });

    // The block stays a summary even though everything is loaded.
    it('shows only the first two in the list', async () => {
        const wrapper = await mountOverview();

        const shown = wrapper
            .findComponent({ name: 'SubscriptionsListStub' })
            .props('subscriptions') as { id: string }[];

        expect(shown.map(({ id }) => id)).toEqual(['ppsu_1', 'ppsu_2']);
    });

    // The modal links a wallet's schedules to subscriptions, so a capped list would lose options.
    it('hands the top-up modal every subscription, not just the shown ones', async () => {
        const wrapper = await mountOverview();

        const handed = wrapper.findComponent({ name: 'TopUpModalStub' }).props('subscriptions') as {
            id: string;
        }[];

        expect(handed).toHaveLength(5);
    });
});
