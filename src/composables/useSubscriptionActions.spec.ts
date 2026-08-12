import { ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { useSubscriptionActions } from './useSubscriptionActions';

const { mockDispatchAction } = vi.hoisted(() => ({
    mockDispatchAction: vi.fn(),
}));

vi.mock('@/components/providers', () => ({
    useActionDispatchProvider: () => ({ dispatchAction: mockDispatchAction }),
}));

const createSubscription = (inactivePeriods?: unknown[]) =>
    ({
        id: 'ppsu_1',
        inactive_periods: inactivePeriods,
    }) as unknown as PricingPlanSubscriptionExpanded;

describe('useSubscriptionActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isCancellable', () => {
        it('is true when the subscription has no inactive periods', () => {
            const { isCancellable } = useSubscriptionActions({
                subscription: ref(createSubscription()),
            });

            expect(isCancellable.value).toBe(true);
        });

        it('is true when the subscription has an empty list of inactive periods', () => {
            const { isCancellable } = useSubscriptionActions({
                subscription: ref(createSubscription([])),
            });

            expect(isCancellable.value).toBe(true);
        });

        it('is false when the subscription has been cancelled', () => {
            const { isCancellable } = useSubscriptionActions({
                subscription: ref(createSubscription([{}])),
            });

            expect(isCancellable.value).toBe(false);
        });

        it('is false while there is no subscription', () => {
            const { isCancellable } = useSubscriptionActions({ subscription: ref(undefined) });

            expect(isCancellable.value).toBe(false);
        });
    });

    describe('isRenewable', () => {
        it('is true when the subscription has been cancelled', () => {
            const { isRenewable } = useSubscriptionActions({
                subscription: ref(createSubscription([{}])),
            });

            expect(isRenewable.value).toBe(true);
        });

        it('is false when the subscription is still running', () => {
            const { isRenewable } = useSubscriptionActions({
                subscription: ref(createSubscription([])),
            });

            expect(isRenewable.value).toBe(false);
        });

        it('is false while there is no subscription', () => {
            const { isRenewable } = useSubscriptionActions({ subscription: ref(undefined) });

            expect(isRenewable.value).toBe(false);
        });
    });

    it('tracks the subscription it is given', () => {
        const subscription = ref<PricingPlanSubscriptionExpanded | undefined>(undefined);
        const { isCancellable, isRenewable } = useSubscriptionActions({ subscription });

        expect(isCancellable.value).toBe(false);

        subscription.value = createSubscription();

        expect(isCancellable.value).toBe(true);
        expect(isRenewable.value).toBe(false);

        subscription.value = createSubscription([{}]);

        expect(isCancellable.value).toBe(false);
        expect(isRenewable.value).toBe(true);
    });

    describe('cancel', () => {
        it('dispatches the cancel subscription action', () => {
            const { cancel } = useSubscriptionActions({
                subscription: ref(createSubscription()),
            });

            cancel();

            expect(mockDispatchAction).toHaveBeenCalledWith({
                action: 'cancel-subscription',
                data: { subscriptionId: 'ppsu_1' },
            });
        });

        it('dispatches nothing while there is no subscription', () => {
            const { cancel } = useSubscriptionActions({ subscription: ref(undefined) });

            cancel();

            expect(mockDispatchAction).not.toHaveBeenCalled();
        });
    });

    describe('renew', () => {
        it('dispatches the renew subscription action', () => {
            const { renew } = useSubscriptionActions({
                subscription: ref(createSubscription([{}])),
            });

            renew();

            expect(mockDispatchAction).toHaveBeenCalledWith({
                action: 'renew-subscription',
                data: { subscriptionId: 'ppsu_1' },
            });
        });

        it('dispatches nothing while there is no subscription', () => {
            const { renew } = useSubscriptionActions({ subscription: ref(undefined) });

            renew();

            expect(mockDispatchAction).not.toHaveBeenCalled();
        });
    });
});
