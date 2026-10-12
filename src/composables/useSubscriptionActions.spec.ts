import { ref } from 'vue';
import { useSubscriptionActions } from './useSubscriptionActions';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { SUBSCRIPTION_CANCELLATION_TYPES } from '@/services/subscriptions';

const { mockDispatchAction } = vi.hoisted(() => ({
    mockDispatchAction: vi.fn(),
}));

vi.mock('@/components/providers', () => ({
    useActionDispatchProvider: () => ({ dispatchAction: mockDispatchAction }),
}));

const CANCELLATION = { type: 'CANCEL', start_at: '2026-11-01T00:00:00Z' };
const PLAN_CHANGE = { type: 'UPGRADE', start_at: '2026-10-20T00:00:00Z' };

const createSubscription = (inactivePeriods?: unknown[], status = 'ACTIVE', type = 'BILLING') =>
    ({
        id: 'ppsu_1',
        status,
        type,
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

        it('is false for a subscription that is not a billing one, which the API refuses', () => {
            const { isCancellable } = useSubscriptionActions({
                subscription: ref(createSubscription([], 'ACTIVE', 'QUOTE')),
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

        it('is false for a subscription that is not a billing one, which the API refuses', () => {
            const { isRenewable } = useSubscriptionActions({
                subscription: ref(createSubscription([CANCELLATION], 'ACTIVE', 'QUOTE')),
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

/**
 * Mirrors the backend: POST /cancel refuses a non-ACTIVE subscription and refuses a new cancel
 * while an open CANCEL exists (getInactivePeriod(CANCEL)); UNDO acts on getInactivePeriod() — the
 * earliest open period of any type — and refuses it once it has started.
 */
describe('useSubscriptionActions offering Cancel and Renew', () => {
    const NOW = '2026-10-12T00:00:00Z';
    const cancel = (start_at: string, end_at?: string) => ({ type: 'CANCEL', start_at, end_at });
    const upgrade = (start_at: string, end_at?: string) => ({ type: 'UPGRADE', start_at, end_at });

    const actionsFor = (inactivePeriods?: unknown[], status = 'ACTIVE') => {
        const { isCancellable, isRenewable } = useSubscriptionActions({
            subscription: ref({
                id: 'ppsu_1',
                status,
                type: 'BILLING',
                inactive_periods: inactivePeriods,
            } as unknown as PricingPlanSubscriptionExpanded),
        });

        return { cancel: isCancellable.value, renew: isRenewable.value };
    };

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(NOW));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it.each([
        ['no inactive periods', undefined, 'ACTIVE', { cancel: true, renew: false }],
        [
            'future CANCEL',
            [cancel('2026-11-01T00:00:00Z')],
            'ACTIVE',
            { cancel: false, renew: true },
        ],
        [
            'pending UPGRADE',
            [upgrade('2026-11-01T00:00:00Z')],
            'ACTIVE',
            { cancel: true, renew: false },
        ],
        [
            'started CANCEL',
            [cancel('2026-10-01T00:00:00Z')],
            'ACTIVE',
            { cancel: false, renew: false },
        ],
        [
            'ended CANCEL',
            [cancel('2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z')],
            'ACTIVE',
            { cancel: true, renew: false },
        ],
        ['CANCELLED status, no periods', [], 'CANCELLED', { cancel: false, renew: false }],
        [
            'DRAFT status with future CANCEL',
            [cancel('2026-11-01T00:00:00Z')],
            'DRAFT',
            { cancel: false, renew: false },
        ],
        [
            'future CANCEL then a later UPGRADE',
            [cancel('2026-11-01T00:00:00Z'), upgrade('2026-12-01T00:00:00Z')],
            'ACTIVE',
            { cancel: false, renew: true },
        ],
        [
            'later UPGRADE listed before the CANCEL',
            [upgrade('2026-12-01T00:00:00Z'), cancel('2026-11-01T00:00:00Z')],
            'ACTIVE',
            { cancel: false, renew: true },
        ],
        [
            'UPGRADE ahead of the CANCEL',
            [upgrade('2026-10-20T00:00:00Z'), cancel('2026-11-01T00:00:00Z')],
            'ACTIVE',
            { cancel: false, renew: false },
        ],
        [
            'UPGRADE ahead of the CANCEL, listed after it',
            [cancel('2026-11-01T00:00:00Z'), upgrade('2026-10-20T00:00:00Z')],
            'ACTIVE',
            { cancel: false, renew: false },
        ],
        [
            'started UPGRADE ahead of a future CANCEL',
            [upgrade('2026-10-01T00:00:00Z'), cancel('2026-11-01T00:00:00Z')],
            'ACTIVE',
            { cancel: false, renew: false },
        ],
    ] as const)('%s', (_name, periods, status, expected) => {
        expect(actionsFor(periods as unknown[] | undefined, status)).toEqual(expected);
    });

    it('renewing sends UNDO', () => {
        expect(SUBSCRIPTION_CANCELLATION_TYPES.RENEW).toBe('UNDO');
    });

    // Backend getInactivePeriod keeps the LAST open period of equal start_at (it overwrites unless
    // the kept one is strictly earlier). With a CANCEL and an UPGRADE starting at the same
    // instant, UNDO acts on the UPGRADE, so there is no Renew to offer.
    it('agrees with the backend on which of two equally early periods UNDO acts on', () => {
        expect(
            actionsFor([cancel('2026-11-01T00:00:00Z'), upgrade('2026-11-01T00:00:00Z')]).renew,
        ).toBe(false);
    });
});
