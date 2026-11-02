import { mount } from '@vue/test-utils';
import SubscriptionPlanSelector from './SubscriptionPlanSelector.vue';
import type { SubscriptionPlanOption } from '@/composables/useSubscriptionPlanGroup';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const options: SubscriptionPlanOption[] = [
    { pricingPlanId: 'ppla_starter', name: 'Starter', isCurrent: true },
    {
        pricingPlanId: 'ppla_pro',
        name: 'Pro',
        isCurrent: false,
        direction: 'UPGRADE',
        changeType: 'IMMEDIATE_PRO_RATA',
    },
];

const mountComponent = ({
    planOptions = options,
    pricingPlanId = 'ppla_starter',
}: {
    planOptions?: SubscriptionPlanOption[];
    pricingPlanId?: string;
} = {}) =>
    mount(SubscriptionPlanSelector, {
        props: {
            options: planOptions,
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

    it('names the choice for assistive technology', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('legend').text()).toContain('Pick your plan');
        expect(wrapper.find('[role="group"]').attributes('aria-label')).toBe('Pick your plan');
    });

    it('describes a plan by its own description', () => {
        const wrapper = mountComponent({
            planOptions: [options[0], { ...options[1], description: 'For growing teams' }],
        });

        expect(wrapper.text()).toContain('For growing teams');
    });

    describe('the current subscription', () => {
        it('is marked, so the customer can see what they are moving from', () => {
            const wrapper = mountComponent();

            expect(wrapper.find('.sv-subscription-plan-selector__current').exists()).toBe(true);
            expect(wrapper.text()).toContain('Current plan');
        });

        // The option is read out by its label, which hides the chip from assistive technology.
        it('is announced as the current plan', () => {
            const wrapper = mountComponent();

            expect(
                wrapper
                    .find('[data-testid="radio-group-item-ppla_starter"]')
                    .attributes('aria-label'),
            ).toBe('Starter (Current plan)');
            expect(
                wrapper.find('[data-testid="radio-group-item-ppla_pro"]').attributes('aria-label'),
            ).toBe('Pro');
        });

        // One marker, on the plan being billed today — not on whichever plan is selected.
        it('is marked once, on the plan being billed today', () => {
            const wrapper = mountComponent({ pricingPlanId: 'ppla_pro' });

            expect(wrapper.findAll('.sv-subscription-plan-selector__current')).toHaveLength(1);
        });
    });

    // The timing of a move is the aside's to state, so it is not repeated on every option.
    it('leaves the timing of a move to the change summary', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).not.toContain('Starts right away');
    });

    it('reports the plan the customer picks', async () => {
        const wrapper = mountComponent();

        const radios = wrapper.findAll('input[type="radio"]');
        await radios[1].setValue();

        expect(wrapper.emitted('update:pricingPlanId')?.at(-1)).toEqual(['ppla_pro']);
    });
});
