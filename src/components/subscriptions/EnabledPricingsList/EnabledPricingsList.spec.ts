import { mount } from '@vue/test-utils';
import type { PricingPlanScheduleInfoExpanded } from '@solvimon/solvimon-types';
import EnabledPricingsList from './EnabledPricingsList.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const createScheduleInfo = (pricings: unknown[] = [{ id: 'pri_1', name: '1.000 credits' }]) =>
    ({
        pricing_plan_schedule: {
            enabled_pricings: (pricings as { id: string }[]).map(({ id }) => ({ pricing_id: id })),
        },
        pricing_plan_version: {
            pricing_categories: [
                { pricing_groups: [{ id: 'pgr_1', name: 'Credit packs', pricings }] },
            ],
        },
    }) as unknown as PricingPlanScheduleInfoExpanded;

const mountComponent = (pricingPlanSchedule = createScheduleInfo()) =>
    mount(EnabledPricingsList, { props: { pricingPlanSchedule } });

describe('EnabledPricingsList', () => {
    it('renders one item per enabled pricing', () => {
        const wrapper = mountComponent(
            createScheduleInfo([
                { id: 'pri_1', name: '1.000 credits' },
                { id: 'pri_2', name: 'Premium support' },
            ]),
        );

        expect(wrapper.findAll('.sv-enabled-pricings-list__item')).toHaveLength(2);
    });

    it('shows the group above the pricing it was chosen from', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.sv-enabled-pricings-list__item-group').text()).toBe('Credit packs');
        expect(wrapper.find('.sv-enabled-pricings-list__item-name').text()).toBe('1.000 credits');
    });

    it('renders the recurring price', () => {
        const wrapper = mountComponent(
            createScheduleInfo([
                {
                    id: 'pri_1',
                    name: '1.000 credits',
                    items: [
                        {
                            configs: [
                                {
                                    details: {
                                        bands: [{ amount: { currency: 'EUR', quantity: '100' } }],
                                        pricing_period: { type: 'MONTH', value: 1 },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ]),
        );

        expect(wrapper.find('.sv-enabled-pricings-list__item-price').text()).toContain('per');
    });

    it('leaves the price line out when there is no amount to show', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.sv-enabled-pricings-list__item-price').exists()).toBe(false);
    });

    it('renders nothing when the schedule has no enabled pricings', () => {
        const wrapper = mountComponent(createScheduleInfo([]));

        expect(wrapper.find('.sv-enabled-pricings-list').exists()).toBe(false);
    });

    it('reports the pricing the customer asked to upgrade', async () => {
        const wrapper = mountComponent();

        await wrapper.find('.sv-enabled-pricings-list__item-upgrade').trigger('click');

        expect(wrapper.emitted('upgrade')?.[0]).toEqual([
            expect.objectContaining({ pricingId: 'pri_1', pricingGroupId: 'pgr_1' }),
        ]);
    });
});
