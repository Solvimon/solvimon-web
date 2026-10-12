import { ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { useSubscriptionActions } from './useSubscriptionActions';

const { mockDispatchAction } = vi.hoisted(() => ({
    mockDispatchAction: vi.fn(),
}));

vi.mock('@/components/providers', () => ({
    useActionDispatchProvider: () => ({ dispatchAction: mockDispatchAction }),
}));

const CANCELLATION = { type: 'CANCEL', start_at: '2026-11-01T00:00:00Z' };
const PLAN_CHANGE = { type: 'UPGRADE', start_at: '2026-10-20T00:00:00Z' };

const createSubscription = (inactivePeriods?: unknown[], status = 'ACTIVE') =>
    ({
        id: 'ppsu_1',
        status,
        inactive_periods: inactivePeriods,
    }) as unknown as PricingPlanSubscriptionExpanded;

describe('useSubscriptionActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-12T00:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
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
                subscription: ref(createSubscription([CANCELLATION])),
            });

            expect(isCancellable.value).toBe(false);
        });

        it('is true while a plan change is pending, which the API still lets be cancelled', () => {
            const { isCancellable } = useSubscriptionActions({
                subscription: ref(createSubscription([PLAN_CHANGE])),
            });

            expect(isCancellable.value).toBe(true);
        });

        it('is true when the only cancellation has an end', () => {
            const { isCancellable } = useSubscriptionActions({
                subscription: ref(
                    createSubscription([{ ...CANCELLATION, end_at: '2026-12-01T00:00:00Z' }]),
                ),
            });

            expect(isCancellable.value).toBe(true);
        });

        it('is false for a subscription that is no longer active', () => {
            const { isCancellable } = useSubscriptionActions({
                subscription: ref(createSubscription([], 'CANCELLED')),
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
                subscription: ref(createSubscription([CANCELLATION])),
            });

            expect(isRenewable.value).toBe(true);
        });

        it('is false when the subscription is still running', () => {
            const { isRenewable } = useSubscriptionActions({
                subscription: ref(createSubscription([])),
            });

            expect(isRenewable.value).toBe(false);
        });

        it('is false for a plan change, which is not a cancellation to undo', () => {
            const { isRenewable } = useSubscriptionActions({
                subscription: ref(createSubscription([PLAN_CHANGE])),
            });

            expect(isRenewable.value).toBe(false);
        });

        it('is false when a plan change comes first, as the API would undo that instead', () => {
            const { isRenewable } = useSubscriptionActions({
                subscription: ref(createSubscription([CANCELLATION, PLAN_CHANGE])),
            });

            expect(isRenewable.value).toBe(false);
        });

        it('is false once the cancellation has taken effect', () => {
            const { isRenewable } = useSubscriptionActions({
                subscription: ref(
                    createSubscription([{ ...CANCELLATION, start_at: '2026-10-01T00:00:00Z' }]),
                ),
            });

            expect(isRenewable.value).toBe(false);
        });

        it('is false for a subscription that is no longer active', () => {
            const { isRenewable } = useSubscriptionActions({
                subscription: ref(createSubscription([CANCELLATION], 'CANCELLED')),
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

        subscription.value = createSubscription([CANCELLATION]);

        expect(isCancellable.value).toBe(false);
        expect(isRenewable.value).toBe(true);
    });

    describe('cancel', () => {
        it('opens the cancel confirmation', () => {
            const { cancel, pendingVariant } = useSubscriptionActions({
                subscription: ref(createSubscription()),
            });

            cancel();

            expect(pendingVariant.value).toBe('CANCEL');
        });

        it('is not handed to the host', () => {
            const { cancel } = useSubscriptionActions({
                subscription: ref(createSubscription()),
            });

            cancel();

            expect(mockDispatchAction).not.toHaveBeenCalled();
        });

        it('opens nothing while there is no subscription', () => {
            const { cancel, pendingVariant } = useSubscriptionActions({
                subscription: ref(undefined),
            });

            cancel();

            expect(pendingVariant.value).toBeUndefined();
        });
    });

    describe('dismiss', () => {
        it('closes whichever confirmation is open', () => {
            const { cancel, dismiss, pendingVariant } = useSubscriptionActions({
                subscription: ref(createSubscription()),
            });

            cancel();
            dismiss();

            expect(pendingVariant.value).toBeUndefined();
        });
    });

    describe('manage', () => {
        it('dispatches the manage subscription action', () => {
            const { manage } = useSubscriptionActions({
                subscription: ref(createSubscription()),
            });

            manage();

            expect(mockDispatchAction).toHaveBeenCalledWith({
                action: 'manage-subscription',
                data: { subscriptionId: 'ppsu_1' },
            });
        });

        it('names the pricing the customer wants to change', () => {
            const { manage } = useSubscriptionActions({
                subscription: ref(createSubscription()),
            });

            manage('pri_credits_1000');

            expect(mockDispatchAction).toHaveBeenCalledWith({
                action: 'manage-subscription',
                data: { subscriptionId: 'ppsu_1', enabledPricingId: 'pri_credits_1000' },
            });
        });

        it('dispatches nothing while there is no subscription', () => {
            const { manage } = useSubscriptionActions({ subscription: ref(undefined) });

            manage();

            expect(mockDispatchAction).not.toHaveBeenCalled();
        });
    });

    describe('renew', () => {
        it('opens the renew confirmation', () => {
            const { renew, pendingVariant } = useSubscriptionActions({
                subscription: ref(createSubscription([CANCELLATION])),
            });

            renew();

            expect(pendingVariant.value).toBe('RENEW');
        });

        it('is not handed to the host', () => {
            const { renew } = useSubscriptionActions({
                subscription: ref(createSubscription([CANCELLATION])),
            });

            renew();

            expect(mockDispatchAction).not.toHaveBeenCalled();
        });

        it('opens nothing while there is no subscription', () => {
            const { renew, pendingVariant } = useSubscriptionActions({
                subscription: ref(undefined),
            });

            renew();

            expect(pendingVariant.value).toBeUndefined();
        });
    });
});
