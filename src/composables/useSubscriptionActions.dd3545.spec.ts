import { ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { useSubscriptionActions } from './useSubscriptionActions';
import { SUBSCRIPTION_CANCELLATION_TYPES } from '@/services/subscriptions';

vi.mock('@/components/providers', () => ({
    useActionDispatchProvider: () => ({ dispatchAction: vi.fn() }),
}));

const NOW = '2026-10-12T00:00:00Z';
const cancel = (start_at: string, end_at?: string) => ({ type: 'CANCEL', start_at, end_at });
const upgrade = (start_at: string, end_at?: string) => ({ type: 'UPGRADE', start_at, end_at });

const actionsFor = (inactivePeriods?: unknown[], status = 'ACTIVE') => {
    const { isCancellable, isRenewable } = useSubscriptionActions({
        subscription: ref({
            id: 'ppsu_1',
            status,
            inactive_periods: inactivePeriods,
        } as unknown as PricingPlanSubscriptionExpanded),
    });

    return { cancel: isCancellable.value, renew: isRenewable.value };
};

/**
 * Mirrors the backend: POST /cancel refuses a non-ACTIVE subscription and refuses a new cancel
 * while an open CANCEL exists (getInactivePeriod(CANCEL)); UNDO acts on getInactivePeriod() — the
 * earliest open period of any type — and refuses it once it has started.
 */
describe('DD-3545 tester: Cancel / Renew matrix', () => {
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
    // the kept one is strictly earlier); the SDK keeps the FIRST. With a CANCEL and an UPGRADE
    // starting at the same instant, the SDK offers Renew while UNDO would act on the UPGRADE.
    it.fails('agrees with the backend on which of two equally early periods UNDO acts on', () => {
        expect(
            actionsFor([cancel('2026-11-01T00:00:00Z'), upgrade('2026-11-01T00:00:00Z')]).renew,
        ).toBe(false);
    });
});
