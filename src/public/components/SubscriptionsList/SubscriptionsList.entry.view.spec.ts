import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import SubscriptionsListEntryView from './SubscriptionsList.entry.view.vue';

const { subscriptionsState } = vi.hoisted(() => ({
    subscriptionsState: {} as {
        error: { value: Error | null };
        hasNextBatch: { value: boolean };
        isPending: { value: boolean };
    },
}));

vi.mock('@/composables/useSubscriptionsList', () => ({
    useSubscriptionsList: () => ({
        items: ref([]),
        error: subscriptionsState.error,
        hasNextBatch: subscriptionsState.hasNextBatch,
        isPending: subscriptionsState.isPending,
        fetchInitial: () => Promise.resolve(),
        fetchMore: () => Promise.resolve(),
    }),
}));

vi.mock('@/composables/useCustomer', () => ({
    useCustomer: () => ({ customer: ref(undefined), get: { execute: () => Promise.resolve() } }),
}));

vi.mock('@/composables/usePaymentMethods', () => ({
    usePaymentMethods: () => ({ items: ref([]), fetchAll: () => Promise.resolve() }),
}));

vi.mock('@/composables/useLoadInitialData', () => ({
    useLoadInitialData: () => ({ isLoading: ref(false) }),
}));

type SlotProps = { hasError: boolean; hasMoreItems: boolean; isLoadingMore: boolean };

const mountView = () => {
    let slotProps: SlotProps | undefined;

    mount(
        defineComponent({
            setup: () => () =>
                h(
                    SubscriptionsListEntryView,
                    { portalObject: { customer_id: 'cust_1' } } as never,
                    {
                        default: (props: SlotProps) => {
                            slotProps = props;
                            return h('div');
                        },
                    },
                ),
        }),
    );

    return slotProps!;
};

describe('SubscriptionsList entry view', () => {
    beforeEach(() => {
        subscriptionsState.error = ref(null);
        subscriptionsState.hasNextBatch = ref(false);
        subscriptionsState.isPending = ref(false);
    });

    it('reports a failed load, so the list does not read as empty', () => {
        subscriptionsState.error.value = new Error('Network error');

        expect(mountView().hasError).toBe(true);
    });

    it('offers the next page while there is one', () => {
        subscriptionsState.hasNextBatch.value = true;
        subscriptionsState.isPending.value = true;

        const slotProps = mountView();

        expect(slotProps.hasError).toBe(false);
        expect(slotProps.hasMoreItems).toBe(true);
        expect(slotProps.isLoadingMore).toBe(true);
    });
});
