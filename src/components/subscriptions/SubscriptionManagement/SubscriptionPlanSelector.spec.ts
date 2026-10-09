import { mount } from '@vue/test-utils';
import SubscriptionPlanSelector from './SubscriptionPlanSelector.vue';
import type { SubscriptionPlanOption } from '@/composables/useSubscriptionPlanGroup';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const options: SubscriptionPlanOption[] = [
    { pricingPlanId: 'ppla_starter', name: 'Starter', order: 1, isCurrent: true },
    {
        pricingPlanId: 'ppla_pro',
        name: 'Pro',
        order: 2,
        isCurrent: false,
        direction: 'UPGRADE',
        changeType: 'IMMEDIATE_PRO_RATA',
    },
];

const mountComponent = ({
    planOptions = options,
    pricingPlanId = 'ppla_starter',
    groupName,
}: {
    planOptions?: SubscriptionPlanOption[];
    pricingPlanId?: string;
    groupName?: string;
} = {}) =>
    mount(SubscriptionPlanSelector, {
        props: {
            options: planOptions,
            groupName,
            pricingPlanId,
            'onUpdate:pricingPlanId': (value?: string) => value,
        },
        global: { stubs: { teleport: true } },
    });

describe('SubscriptionPlanSelector', () => {
    it('offers every plan of the group', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Starter');
        expect(wrapper.text()).toContain('Pro');
    });

    it('names the choice after the group', () => {
        const wrapper = mountComponent({ groupName: 'Workspace plans' });

        expect(wrapper.text()).toContain('Workspace plans');
    });

    it('falls back to a generic heading when the group has no name', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Plan');
    });

    it('marks the plan the subscription runs on today', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Your current plan');
    });

    it('says a move takes effect right away for an immediate transition', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Starts right away');
    });

    it('says a move waits for the next billing period when the group times it that way', () => {
        const wrapper = mountComponent({
            planOptions: [
                options[0],
                { ...options[1], direction: 'DOWNGRADE', changeType: 'NEXT_BILLING_PERIOD' },
            ],
        });

        expect(wrapper.text()).toContain('Starts on your next billing period');
    });

    it('describes a plan by its own description alongside the timing', () => {
        const wrapper = mountComponent({
            planOptions: [options[0], { ...options[1], description: 'For growing teams' }],
        });

        expect(wrapper.text()).toContain('For growing teams · Starts right away');
    });

    it('reports the plan the customer picks', async () => {
        const wrapper = mountComponent();

        const radios = wrapper.findAll('input[type="radio"]');
        await radios[1].setValue();

        expect(wrapper.emitted('update:pricingPlanId')?.at(-1)).toEqual(['ppla_pro']);
    });
});
