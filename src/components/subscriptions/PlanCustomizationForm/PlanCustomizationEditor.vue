<script setup lang="ts">
import { Section, useIntl } from '@solvimon/solvimon-ui';
import type { ConfiguredMeterValue, Pricing } from '@solvimon/solvimon-types';
import { computed } from 'vue';
import SeatsEditor from './SeatsEditor.vue';
import type { PlanCustomizationEditorProps } from './PlanCustomizationEditor.types';
import AddonSingleEditor from './AddonSingleEditor.vue';
import AddonMultipleEditor from './AddonMultipleEditor.vue';
import PricingGroupSingleEditor from './PricingGroupSingleEditor.vue';
import { getFirstPricingPlanScheduleOfType } from '@/utils/pricingPlanSchedule';
import { getPricingGroupsFromExtendedPricingPlanSubscription } from '@/utils/subscription';
import { getAllPricingsFromPricingPlanVersion } from '@/utils/pricingPlanVersion';

const props = defineProps<PlanCustomizationEditorProps>();

const seatsModel = defineModel<ConfiguredMeterValue[]>('seatsValues', { required: true });
const enabledPricingIdsModel = defineModel<Pricing['id'][]>('enabledPricingIds', {
    required: true,
});

const { $t } = useIntl();

const pricings = computed(() => {
    const pricingPlanVersion = getFirstPricingPlanScheduleOfType({
        pricingPlanScheduleInfos: props.subscription.pricing_plan_schedule_infos,
        type: 'DEFAULT',
    })?.pricing_plan_version;

    if (!pricingPlanVersion) {
        return [];
    }

    return getAllPricingsFromPricingPlanVersion(pricingPlanVersion);
});

const addonPricings = computed(() =>
    pricings.value.filter((pricing) => pricing.product_type === 'ADDON'),
);

const pricingGroups = computed(() =>
    getPricingGroupsFromExtendedPricingPlanSubscription(props.subscription),
);
</script>

<template>
    <Section
        class="sv-plan-customization"
        :title="
            $t({
                defaultMessage: 'Customize plan',
                id: 'checkout.customize_plan_block.title',
                description: 'The title of the customize plan block in the checkout form',
            })
        "
        no-spacing
        no-border
        content-background="none"
    >
        <div class="sv-plan-customization__body grid grid-cols-1 gap-1">
            <!-- seats-->
            <SeatsEditor
                v-model="seatsModel"
                class="sv-plan-customization__seats"
                :initial-seats-values="initialSeatsValues"
                :pricings="pricings"
            />

            <!-- pricing group level addons-->
            <template v-for="pricingGroup in pricingGroups" :key="pricingGroup.id">
                <PricingGroupSingleEditor
                    v-if="
                        pricingGroup.product_type === 'DEFAULT' &&
                        pricingGroup.selection_constraint === 'EXACTLY_ONE'
                    "
                    v-model="enabledPricingIdsModel"
                    class="sv-plan-customization__group"
                    :group-name="pricingGroup.name"
                    :pricings="pricingGroup.pricings"
                    :billing-period="billingPeriod"
                    :currency="currency"
                />

                <AddonSingleEditor
                    v-else-if="
                        pricingGroup.product_type === 'ADDON' &&
                        pricingGroup.selection_constraint === 'AT_MOST_ONE'
                    "
                    v-model="enabledPricingIdsModel"
                    class="sv-plan-customization__group"
                    :group-name="pricingGroup.name"
                    :pricings="pricingGroup.pricings"
                    :constraint="pricingGroup.selection_constraint"
                    :billing-period="billingPeriod"
                    :currency="currency"
                />

                <AddonMultipleEditor
                    v-else-if="
                        pricingGroup.product_type === 'ADDON' &&
                        pricingGroup.selection_constraint === 'ANY'
                    "
                    v-model="enabledPricingIdsModel"
                    class="sv-plan-customization__group"
                    :pricings="pricingGroup.pricings"
                    :group-name="pricingGroup.name"
                    :billing-period="billingPeriod"
                    :currency="currency"
                />
            </template>

            <!-- product level addons -->
            <AddonMultipleEditor
                v-model="enabledPricingIdsModel"
                class="sv-plan-customization__group"
                :pricings="addonPricings"
                :billing-period="billingPeriod"
                :currency="currency"
            />
        </div>
    </Section>
</template>
