import { mount } from '@vue/test-utils';
import { defineComponent, h, ref, shallowRef } from 'vue';
import SubscriptionDetailsEntryView from './SubscriptionDetails.entry.view.vue';

const { subscriptionState, mockFetchSubscription, mockLogError } = vi.hoisted(() => ({
    subscriptionState: {} as {
        subscription: { value: unknown };
        error: { value: Error | null };
    },
    mockFetchSubscription: vi.fn(),
    mockLogError: vi.fn(),
}));

vi.mock('@/composables/useSubscription', () => ({
    useSubscription: () => ({
        subscription: subscriptionState.subscription,
        error: subscriptionState.error,
        get: mockFetchSubscription,
    }),
}));

vi.mock('@/utils/pricingPlanScheduleOverrides', () => ({
    getSchedulesWithPlanData: () => [],
}));

vi.mock('@/composables/useCustomer', () => ({
    useCustomer: () => ({ customer: ref(undefined), get: { execute: () => Promise.resolve() } }),
}));

vi.mock('@/composables/usePaymentMethods', () => ({
    usePaymentMethods: () => ({ items: ref([]), fetchAll: () => Promise.resolve() }),
}));

vi.mock('@/composables/useCustomerWalletBalances', () => ({
    useCustomerWalletBalances: () => ({
        walletBalances: ref(undefined),
        apiStatus: ref('DONE'),
        fetch: () => Promise.resolve(),
    }),
}));

vi.mock('@/composables/useLoadInitialData', () => ({
    useLoadInitialData: () => ({ isLoading: ref(false) }),
}));

vi.mock('@/composables/useChargeableOnDemandItems', () => ({
    useChargeableOnDemandItems: () => ({ items: ref([]), scheduleId: ref(undefined) }),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLogError }),
}));

type SlotProps = {
    subscription: unknown;
    error: Error | null;
    refreshSubscription: () => Promise<unknown>;
};

const mountView = () => {
    let slotProps: SlotProps | undefined;

    mount(
        defineComponent({
            setup: () => () =>
                h(
                    SubscriptionDetailsEntryView,
                    {
                        portalObject: { customer_id: 'cust_1' },
                        configuration: { subscriptionId: 'ppsu_1' },
                    } as never,
                    {
                        default: (props: SlotProps) => {
                            slotProps = props;
                            return h('div');
                        },
                    },
                ),
        }),
    );

    return () => slotProps!;
};

describe('SubscriptionDetails entry view', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        subscriptionState.subscription = shallowRef(undefined);
        subscriptionState.error = ref(null);
        mockFetchSubscription.mockResolvedValue(undefined);
    });

    it('hands on the error when the subscription could not be loaded at all', () => {
        subscriptionState.error.value = new Error('Not found');

        const slotProps = mountView();

        expect(slotProps().error).toStrictEqual(new Error('Not found'));
    });

    it('keeps the subscription on screen when reloading it fails', async () => {
        subscriptionState.subscription.value = { id: 'ppsu_1' };
        const slotProps = mountView();
        const failure = new Error('Network error');

        mockFetchSubscription.mockImplementationOnce(() => {
            subscriptionState.error.value = failure;
            return Promise.reject(failure);
        });

        await expect(slotProps().refreshSubscription()).resolves.toBeUndefined();

        expect(slotProps().error).toBeNull();
        expect(slotProps().subscription).toStrictEqual({ id: 'ppsu_1' });
        expect(mockLogError).toHaveBeenCalledWith(
            'SUBSCRIPTION_LOAD_FAILED',
            expect.any(String),
            {},
            failure,
        );
    });
});
