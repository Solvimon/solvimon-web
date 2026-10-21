import { mount } from '@vue/test-utils';
import type {
    PricingExtended,
    PricingGroupExtended,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import PlanCustomizationEditor from './PlanCustomizationEditor.vue';
import PricingGroupSingleEditor from './PricingGroupSingleEditor.vue';
import SeatsEditor from './SeatsEditor.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

const pricing = (id: string): PricingExtended =>
    ({
        object_type: 'PRICING',
        id,
        pricing_group_id: 'server-type',
        product_type: 'ADDON',
        product_ids: [],
    }) as PricingExtended;

const serverGroup = (
    productType: PricingGroupExtended['product_type'],
    pricings: PricingExtended[],
): PricingGroupExtended =>
    ({
        object_type: 'PRICING_GROUP',
        id: 'server-type',
        pricing_plan_version_id: 'version-1',
        name: 'Server type',
        product_type: productType,
        selection_constraint: 'EXACTLY_ONE',
        pricings,
    }) as PricingGroupExtended;

const subscriptionWith = (group: PricingGroupExtended): PricingPlanSubscriptionExpanded =>
    ({
        object_type: 'PRICING_PLAN_SUBSCRIPTION',
        id: 'subscription-1',
        pricing_plan_schedule_infos: [
            {
                id: 'schedule-1',
                type: 'DEFAULT',
                pricing_plan_version: {
                    pricing_categories: [
                        { product_category_id: 'category-1', pricing_groups: [group] },
                    ],
                },
            },
        ],
    }) as unknown as PricingPlanSubscriptionExpanded;

const mountEditor = (group: PricingGroupExtended) =>
    mount(PlanCustomizationEditor, {
        props: {
            subscription: subscriptionWith(group),
            seatsValues: [],
            unitsValues: [],
            enabledPricingIds: [],
            billingPeriod: { type: 'MONTH', value: 1 },
        },
        global: {
            stubs: {
                SeatsEditor: true,
                UnitsEditor: true,
                PricingGroupSingleEditor: true,
                AddonSingleEditor: true,
                AddonMultipleEditor: true,
            },
        },
    });

describe('PlanCustomizationEditor', () => {
    it.each(['DEFAULT', 'ADDON'] as const)(
        'offers a choice between the members of a %s group that takes exactly one',
        (productType) => {
            const pricings = [pricing('h200'), pricing('b300')];
            const wrapper = mountEditor(serverGroup(productType, pricings));

            expect(wrapper.findComponent(PricingGroupSingleEditor).props('pricings')).toEqual(
                pricings,
            );
        },
    );

    it('looks up seat labels and prices among the group members too', () => {
        const pricings = [pricing('h200'), pricing('b300')];
        const wrapper = mountEditor(serverGroup('ADDON', pricings));

        expect(wrapper.findComponent(SeatsEditor).props('pricings')).toEqual(pricings);
    });
});
