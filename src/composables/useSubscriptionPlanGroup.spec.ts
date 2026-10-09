import type { PricingPlan, PricingPlanScheduleInfoExpanded } from '@solvimon/solvimon-types';
import { useSubscriptionPlanGroup } from './useSubscriptionPlanGroup';
import type { PricingPlanGroup } from '@/types/pricingPlanGroup';
import { ApiError } from '@/services/apiError';

const { mockGetPricingPlanGroup, mockGetPricingPlan, mockWarn, mockError } = vi.hoisted(() => ({
    mockGetPricingPlanGroup: vi.fn(),
    mockGetPricingPlan: vi.fn(),
    mockWarn: vi.fn(),
    mockError: vi.fn(),
}));

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: () => ({
        getSubscriptionPricingPlanGroup: mockGetPricingPlanGroup,
    }),
}));

vi.mock('@/services/pricingPlans', () => ({
    createPricingPlansService: () => ({ getPricingPlan: mockGetPricingPlan }),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockError, warn: mockWarn, info: vi.fn(), debug: vi.fn() }),
}));

const SUBSCRIPTION_ID = 'ppsu_1';

const createScheduleInfo = ({ pricingPlanId = 'ppla_starter' }: { pricingPlanId?: string } = {}) =>
    ({
        id: 'ppsc_1',
        pricing_plan_version: {
            pricing_plan: { id: pricingPlanId, name: 'Starter' },
        },
    }) as unknown as PricingPlanScheduleInfoExpanded;

const createGroup = (overrides: Partial<PricingPlanGroup> = {}): PricingPlanGroup =>
    ({
        object_type: 'PRICING_PLAN_GROUP',
        id: 'ppgr_1',
        reference: 'workspace-plans',
        name: 'Workspace plans',
        status: 'ACTIVE',
        upgrade_type: 'IMMEDIATE_PRO_RATA',
        downgrade_type: 'NEXT_BILLING_PERIOD',
        cancellation_type: 'NEXT_BILLING_PERIOD',
        pricing_plans: [
            { pricing_plan_id: 'ppla_starter', order: 1 },
            { pricing_plan_id: 'ppla_pro', order: 2 },
        ],
        ...overrides,
    }) as PricingPlanGroup;

describe('useSubscriptionPlanGroup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetPricingPlanGroup.mockResolvedValue(createGroup());
        mockGetPricingPlan.mockImplementation(({ pricingPlanId }: { pricingPlanId: string }) =>
            Promise.resolve({ id: pricingPlanId, name: 'Pro' }),
        );
    });

    it('offers the plans of the group the current plan belongs to', async () => {
        const { options, group, load } = useSubscriptionPlanGroup();

        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        expect(mockGetPricingPlanGroup).toHaveBeenCalledWith({ id: SUBSCRIPTION_ID });
        expect(group.value?.name).toBe('Workspace plans');
        expect(options.value.map(({ pricingPlanId }) => pricingPlanId)).toEqual([
            'ppla_starter',
            'ppla_pro',
        ]);
    });

    it('marks the plan the subscription runs on today', async () => {
        const { options, currentPricingPlanId, load } = useSubscriptionPlanGroup();

        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        expect(currentPricingPlanId.value).toBe('ppla_starter');
        expect(options.value.find(({ isCurrent }) => isCurrent)?.pricingPlanId).toBe(
            'ppla_starter',
        );
    });

    it('labels an option from the plan the response expanded, fetching nothing', async () => {
        mockGetPricingPlanGroup.mockResolvedValue(
            createGroup({
                pricing_plans: [
                    { pricing_plan_id: 'ppla_starter', order: 1 },
                    {
                        pricing_plan_id: 'ppla_pro',
                        order: 2,
                        pricing_plan: { id: 'ppla_pro', name: 'Pro plan' } as PricingPlan,
                    },
                ],
            }),
        );

        const { options, load } = useSubscriptionPlanGroup();
        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        expect(mockGetPricingPlan).not.toHaveBeenCalled();
        expect(options.value.find(({ pricingPlanId }) => pricingPlanId === 'ppla_pro')?.name).toBe(
            'Pro plan',
        );
    });

    // The portal may answer with ids only, in which case each plan still has to be read.
    it('falls back to fetching a member plan the response did not expand', async () => {
        const { options, load } = useSubscriptionPlanGroup();

        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        expect(mockGetPricingPlan).toHaveBeenCalledTimes(1);
        expect(mockGetPricingPlan).toHaveBeenCalledWith({ pricingPlanId: 'ppla_pro' });
        expect(options.value.find(({ isCurrent }) => isCurrent)?.name).toBe('Starter');
    });

    it('offers the plans cheapest first, whatever order the group lists them in', async () => {
        mockGetPricingPlanGroup.mockResolvedValue(
            createGroup({
                pricing_plans: [
                    { pricing_plan_id: 'ppla_pro', order: 2 },
                    { pricing_plan_id: 'ppla_starter', order: 1 },
                ],
            }),
        );

        const { options, load } = useSubscriptionPlanGroup();
        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        expect(options.value.map(({ pricingPlanId }) => pricingPlanId)).toEqual([
            'ppla_starter',
            'ppla_pro',
        ]);
    });

    describe('direction', () => {
        it('reads a move up the order as an upgrade, timed as the group times upgrades', async () => {
            const { options, load } = useSubscriptionPlanGroup();

            await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

            expect(options.value.find(({ pricingPlanId }) => pricingPlanId === 'ppla_pro')).toEqual(
                expect.objectContaining({
                    direction: 'UPGRADE',
                    changeType: 'IMMEDIATE_PRO_RATA',
                }),
            );
        });

        it('reads a move down the order as a downgrade', async () => {
            const { options, load } = useSubscriptionPlanGroup();

            await load({
                subscriptionId: SUBSCRIPTION_ID,
                scheduleInfo: createScheduleInfo({ pricingPlanId: 'ppla_pro' }),
            });

            expect(
                options.value.find(({ pricingPlanId }) => pricingPlanId === 'ppla_starter'),
            ).toEqual(
                expect.objectContaining({
                    direction: 'DOWNGRADE',
                    changeType: 'NEXT_BILLING_PERIOD',
                }),
            );
        });

        it('leaves the current plan without a direction of its own', async () => {
            const { options, load } = useSubscriptionPlanGroup();

            await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

            const current = options.value.find(({ isCurrent }) => isCurrent);

            expect(current?.direction).toBeUndefined();
            expect(current?.changeType).toBeUndefined();
        });
    });

    it('leaves out a transition the merchant has closed off', async () => {
        mockGetPricingPlanGroup.mockResolvedValue(createGroup({ upgrade_type: 'NOT_ALLOWED' }));

        const { options, load } = useSubscriptionPlanGroup();
        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        expect(options.value.map(({ pricingPlanId }) => pricingPlanId)).toEqual(['ppla_starter']);
    });

    it('offers nothing while the group is not active', async () => {
        mockGetPricingPlanGroup.mockResolvedValue(createGroup({ status: 'DRAFT' }));

        const { options, group, load } = useSubscriptionPlanGroup();
        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        expect(options.value).toEqual([]);
        expect(group.value).toBeUndefined();
    });

    it('offers nothing when the group does not hold the plan being billed', async () => {
        mockGetPricingPlanGroup.mockResolvedValue(
            createGroup({ pricing_plans: [{ pricing_plan_id: 'ppla_other', order: 1 }] }),
        );

        const { options, load } = useSubscriptionPlanGroup();
        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        expect(options.value).toEqual([]);
    });

    it('offers nothing for a subscription whose plan belongs to no group', async () => {
        mockGetPricingPlanGroup.mockRejectedValue(new ApiError({ statusCode: 404 }));

        const { options, error, load } = useSubscriptionPlanGroup();
        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        // The ordinary case for most subscriptions, so nothing is reported as a failure.
        expect(options.value).toEqual([]);
        expect(error.value).toBeUndefined();
        expect(mockError).not.toHaveBeenCalled();
    });

    it('asks for nothing while there is no schedule to read a plan off', async () => {
        const { options, currentPricingPlanId, load } = useSubscriptionPlanGroup();

        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: undefined });

        expect(mockGetPricingPlanGroup).not.toHaveBeenCalled();
        expect(currentPricingPlanId.value).toBeUndefined();
        expect(options.value).toEqual([]);
    });

    it('drops a member plan it cannot read and keeps offering the rest', async () => {
        mockGetPricingPlan.mockRejectedValue(new Error('gone'));

        const { options, load } = useSubscriptionPlanGroup();
        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        expect(mockWarn).toHaveBeenCalledWith(
            'PRICING_PLAN_GROUP_MEMBER_SKIPPED',
            expect.any(String),
            {},
            expect.any(Error),
        );
        expect(options.value.map(({ pricingPlanId }) => pricingPlanId)).toEqual(['ppla_starter']);
    });

    it('reports a group that cannot be loaded and offers nothing', async () => {
        const failure = new Error('boom');
        mockGetPricingPlanGroup.mockRejectedValue(failure);

        const { options, error, isPending, load } = useSubscriptionPlanGroup();
        await load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        expect(mockError).toHaveBeenCalledWith(
            'PRICING_PLAN_GROUP_LOAD_FAILED',
            expect.any(String),
            {},
            failure,
        );
        expect(error.value).toBe(failure);
        expect(options.value).toEqual([]);
        expect(isPending.value).toBe(false);
    });

    it('lets only the newest load write the options', async () => {
        const slowGroup = createGroup({ name: 'Stale group' });
        mockGetPricingPlanGroup.mockImplementationOnce(
            () => new Promise((resolve) => setTimeout(() => resolve(slowGroup), 10)),
        );

        const { group, load } = useSubscriptionPlanGroup();

        const slow = load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });
        const fast = load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });

        await Promise.all([slow, fast]);

        expect(group.value?.name).toBe('Workspace plans');
    });
});
