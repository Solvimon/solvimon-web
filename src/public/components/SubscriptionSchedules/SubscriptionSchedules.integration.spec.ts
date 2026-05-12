import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type {
    PricingPlanScheduleWithPlanData,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import SubscriptionSchedulesEntry from './SubscriptionSchedules.entry.vue';
import type { SolvimonSubscriptionSchedulesEntryProps } from './SubscriptionSchedules.entry.types';

const { mockUseSubscription, mockUseLoadInitialData, mockGet, mockWithPlanData } = vi.hoisted(
    () => ({
        mockUseSubscription: vi.fn(),
        mockUseLoadInitialData: vi.fn(),
        mockGet: vi.fn(),
        mockWithPlanData: vi.fn(),
    }),
);

vi.mock('./SubscriptionSchedules.entry.ce', () => ({
    COMPONENT_NAME: 'solvimon-subscription-schedules',
    SolvimonSubscriptionSchedules: {},
    defineSolvimonSubscriptionSchedules: () => {},
}));

vi.mock('@/composables/useSubscription', () => ({
    useSubscription: mockUseSubscription,
}));

vi.mock('@/composables/useLoadInitialData', () => ({
    useLoadInitialData: mockUseLoadInitialData,
}));

vi.mock('@/components/providers', async () => ({
    Provider: defineComponent({
        inheritAttrs: false,
        setup(_, { slots }) {
            return () => slots.default?.();
        },
    }),
    useActionDispatchProvider: () => ({
        dispatchAction: vi.fn(),
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual = await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    const { mockUseIntl } = await import('@/test-utils/useIntlMock');
    return {
        ...actual,
        useIntl: mockUseIntl,
        PricingPlanSchedules: defineComponent({
            name: 'PricingPlanSchedulesStub',
            props: { schedules: { type: Array, required: true } },
            setup(props) {
                return () =>
                    h('div', { 'data-testid': 'pricing-plan-schedules-stub' }, [
                        `${(props.schedules as unknown[]).length} schedules`,
                    ]);
            },
        }),
    };
});

describe('SubscriptionSchedules entry component', () => {
    const subscriptionId = 'sub_123' as PricingPlanSubscriptionExpanded['id'];

    const subscription = {
        id: subscriptionId,
        pricing_plan_schedule_infos: [],
    } as unknown as PricingPlanSubscriptionExpanded;

    const schedulesData = [
        {
            schedule: { id: 'sched_1' },
            selectedPricingPlan: { id: 'plan_1' },
            selectedPricingPlanVersion: { id: 'ver_1' },
        },
    ] as unknown as PricingPlanScheduleWithPlanData[];

    const defaultProps: SolvimonSubscriptionSchedulesEntryProps = {
        environment: 'TEST',
        locale: 'en-US',
        customElementName: 'solvimon-subscription-schedules',
        portalObject: {
            object_type: 'PORTAL_URL',
            id: 'purl_example',
            type: 'CUSTOMER',
            customer_id: 'cus_123',
            token: 'test-portal-token',
            status: 'PUBLISHED',
        } as unknown as SolvimonSubscriptionSchedulesEntryProps['portalObject'],
        configuration: { subscriptionId },
    };

    const mountComponent = ({
        withSubscription = true,
        isLoading = false,
    }: {
        withSubscription?: boolean;
        isLoading?: boolean;
    } = {}) => {
        mockUseSubscription.mockReturnValue({
            subscription: ref(withSubscription ? subscription : undefined),
            withPlanData: mockWithPlanData,
            get: mockGet,
        });

        mockUseLoadInitialData.mockReturnValue({
            isLoading: ref(isLoading),
        });

        return mount(SubscriptionSchedulesEntry, {
            props: defaultProps,
            global: {
                stubs: { teleport: true },
            },
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGet.mockResolvedValue(subscription);
        mockWithPlanData.mockReturnValue(schedulesData);
    });

    it('requests the subscription using the subscription ID from the configuration', () => {
        mountComponent();

        expect(mockUseSubscription).toHaveBeenCalledWith({ subscriptionId });
    });

    it('does not render when subscription data has not yet loaded', () => {
        const wrapper = mountComponent({ withSubscription: false });

        expect(wrapper.text()).toBe('');
    });

    it('renders the schedules section title when data is loaded', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Schedules');
    });

    it('passes the transformed schedule data to PricingPlanSchedules', () => {
        const wrapper = mountComponent();

        expect(wrapper.get('[data-testid="pricing-plan-schedules-stub"]')).toBeTruthy();
        expect(mockWithPlanData).toHaveBeenCalledWith(subscription);
    });
});
