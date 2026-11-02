import type { PricingPlan, PricingPlanScheduleInfoExpanded } from '@solvimon/solvimon-types';
import { useSubscriptionPlanGroup } from './useSubscriptionPlanGroup';
import type { PricingPlanGroup, PricingPlanGroupMember } from '@/types/pricingPlanGroup';
import { ApiError } from '@/services/apiError';

const { mockGetPricingPlanGroup, mockError } = vi.hoisted(() => ({
    mockGetPricingPlanGroup: vi.fn(),
    mockError: vi.fn(),
}));

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: () => ({
        getSubscriptionPricingPlanGroup: mockGetPricingPlanGroup,
    }),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

const SUBSCRIPTION_ID = 'ppsu_1';

const createScheduleInfo = (pricingPlanId = 'ppla_starter') =>
    ({
        id: 'ppsc_1',
        pricing_plan_version: {
            pricing_plan_id: pricingPlanId,
            pricing_plan: { id: pricingPlanId, name: 'Starter' },
        },
    }) as unknown as PricingPlanScheduleInfoExpanded;

const member = (id: string, order: number, name = id): PricingPlanGroupMember => ({
    pricing_plan_id: id,
    order,
    pricing_plan: { id, name } as PricingPlan,
});

const createGroup = (overrides: Partial<PricingPlanGroup> = {}): PricingPlanGroup => ({
    object_type: 'PRICING_PLAN_GROUP',
    id: 'ppgr_1',
    reference: 'workspace-plans',
    name: 'Workspace plans',
    status: 'ACTIVE',
    upgrade_type: 'IMMEDIATE_PRO_RATA',
    downgrade_type: 'NEXT_BILLING_PERIOD',
    cancellation_type: 'NEXT_BILLING_PERIOD',
    pricing_plans: [member('ppla_pro', 2, 'Pro plan'), member('ppla_starter', 1, 'Starter')],
    ...overrides,
});

const loadOptions = async (scheduleInfo = createScheduleInfo()) => {
    const planGroup = useSubscriptionPlanGroup();
    await planGroup.load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo });
    return planGroup;
};

const ids = (options: { pricingPlanId: string }[]) =>
    options.map(({ pricingPlanId }) => pricingPlanId);

describe('useSubscriptionPlanGroup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetPricingPlanGroup.mockResolvedValue(createGroup());
    });

    it('offers the plans of the group cheapest first, labelled by their expanded plans', async () => {
        const { options, currentPricingPlanId } = await loadOptions();

        expect(mockGetPricingPlanGroup).toHaveBeenCalledWith({ id: SUBSCRIPTION_ID });
        expect(currentPricingPlanId.value).toBe('ppla_starter');
        expect(options.value).toEqual([
            { pricingPlanId: 'ppla_starter', name: 'Starter', isCurrent: true },
            {
                pricingPlanId: 'ppla_pro',
                name: 'Pro plan',
                isCurrent: false,
                direction: 'UPGRADE',
                changeType: 'IMMEDIATE_PRO_RATA',
            },
        ]);
    });

    it('reads a move down the order as a downgrade, timed as the group times downgrades', async () => {
        const { options } = await loadOptions(createScheduleInfo('ppla_pro'));

        expect(options.value.find(({ pricingPlanId }) => pricingPlanId === 'ppla_starter')).toEqual(
            expect.objectContaining({ direction: 'DOWNGRADE', changeType: 'NEXT_BILLING_PERIOD' }),
        );
    });

    it.each([
        ['closed off', { upgrade_type: 'NOT_ALLOWED' }],
        ['left untimed', { upgrade_type: null }],
        [
            'at the same place in the group',
            { pricing_plans: [member('ppla_starter', 1), member('ppla_pro', 1)] },
        ],
    ] as const)('leaves out a move %s', async (_, overrides) => {
        mockGetPricingPlanGroup.mockResolvedValue(
            createGroup(overrides as Partial<PricingPlanGroup>),
        );

        const { options } = await loadOptions();

        expect(ids(options.value)).toEqual(['ppla_starter']);
    });

    it.each([
        ['the group is not active', createGroup({ status: 'DRAFT' })],
        [
            'the group does not hold the plan being billed',
            createGroup({ pricing_plans: [member('ppla_other', 1)] }),
        ],
    ])('offers nothing when %s', async (_, group) => {
        mockGetPricingPlanGroup.mockResolvedValue(group);

        const { options } = await loadOptions();

        expect(options.value).toEqual([]);
    });

    it('offers nothing, and reports nothing, for a plan that belongs to no group', async () => {
        mockGetPricingPlanGroup.mockRejectedValue(new ApiError({ statusCode: 404 }));

        const { options, error } = await loadOptions();

        expect(options.value).toEqual([]);
        expect(error.value).toBeUndefined();
        expect(mockError).not.toHaveBeenCalled();
    });

    it('reports a group that cannot be loaded and offers nothing', async () => {
        const failure = new Error('boom');
        mockGetPricingPlanGroup.mockRejectedValue(failure);

        const { options, error, isPending } = await loadOptions();

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

    it('asks for nothing while there is no plan to move from', async () => {
        const { options, currentPricingPlanId } = await loadOptions(
            {} as PricingPlanScheduleInfoExpanded,
        );

        expect(mockGetPricingPlanGroup).not.toHaveBeenCalled();
        expect(currentPricingPlanId.value).toBeUndefined();
        expect(options.value).toEqual([]);
    });

    it('lets only the newest load write the options, even one that has no plan to move from', async () => {
        let resolveSlow: (group: PricingPlanGroup) => void = () => {};
        mockGetPricingPlanGroup.mockImplementationOnce(
            () => new Promise((resolve) => (resolveSlow = resolve)),
        );

        const { options, isPending, load } = useSubscriptionPlanGroup();

        const slow = load({ subscriptionId: SUBSCRIPTION_ID, scheduleInfo: createScheduleInfo() });
        await load({
            subscriptionId: SUBSCRIPTION_ID,
            scheduleInfo: {} as PricingPlanScheduleInfoExpanded,
        });
        resolveSlow(createGroup());
        await slow;

        expect(options.value).toEqual([]);
        expect(isPending.value).toBe(false);
    });

    it('keeps the options on screen while a reload is out', async () => {
        const planGroup = await loadOptions();
        mockGetPricingPlanGroup.mockImplementationOnce(() => new Promise(() => {}));

        void planGroup.load({
            subscriptionId: SUBSCRIPTION_ID,
            scheduleInfo: createScheduleInfo(),
        });

        expect(ids(planGroup.options.value)).toEqual(['ppla_starter', 'ppla_pro']);
        expect(planGroup.isPending.value).toBe(true);
    });
});
