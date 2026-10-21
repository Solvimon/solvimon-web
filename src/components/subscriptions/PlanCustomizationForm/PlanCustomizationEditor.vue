<script setup lang="ts">
import { Section, useIntl } from '@solvimon/solvimon-ui';
import type { ConfiguredMeterValue, Pricing } from '@solvimon/solvimon-types';
import { computed } from 'vue';
import SeatsEditor from './SeatsEditor.vue';
import UnitsEditor from './UnitsEditor.vue';
import type { PlanCustomizationEditorProps } from './PlanCustomizationEditor.types';
import AddonSingleEditor from './AddonSingleEditor.vue';
import AddonMultipleEditor from './AddonMultipleEditor.vue';
import PricingGroupSingleEditor from './PricingGroupSingleEditor.vue';
import PricingGroupSeatsEditor from './PricingGroupSeatsEditor.vue';
import { getFirstPricingPlanScheduleOfType } from '@/utils/pricingPlanSchedule';
import { getPricingGroupsFromExtendedPricingPlanSubscription } from '@/utils/subscription';
import {
    getPricingsFromScheduleInfo,
    getPricingsWithGroupsFromScheduleInfo,
} from '@/utils/pricing';
import { getSeatConfigIdByPricingId } from '@/utils/meterValues';

const props = defineProps<PlanCustomizationEditorProps>();

const seatsModel = defineModel<ConfiguredMeterValue[]>('seatsValues', { required: true });
const unitsModel = defineModel<ConfiguredMeterValue[]>('unitsValues', { required: true });
const enabledPricingIdsModel = defineModel<Pricing['id'][]>('enabledPricingIds', {
    required: true,
});

const { $t } = useIntl();

const scheduleInfo = computed(() =>
    getFirstPricingPlanScheduleOfType({
        pricingPlanScheduleInfos: props.subscription.pricing_plan_schedule_infos,
        type: 'DEFAULT',
    }),
);

const pricings = computed(() =>
    scheduleInfo.value?.pricing_plan_version ? getPricingsFromScheduleInfo(scheduleInfo.value) : [],
);

// Seats and units can belong to a group member, so their labels and prices are looked up in those too.
const meterPricings = computed(() =>
    scheduleInfo.value?.pricing_plan_version
        ? getPricingsWithGroupsFromScheduleInfo(scheduleInfo.value)
        : [],
);

const addonPricings = computed(() =>
    pricings.value.filter((pricing) => pricing.product_type === 'ADDON'),
);

const pricingGroups = computed(() =>
    getPricingGroupsFromExtendedPricingPlanSubscription(props.subscription),
);

// A group of seat-based products that takes exactly one puts each product's stepper on its own option.
const seatConfigIdsByGroupId = computed(
    () =>
        new Map(
            pricingGroups.value.flatMap((pricingGroup) => {
                if (pricingGroup.selection_constraint !== 'EXACTLY_ONE' || !scheduleInfo.value) {
                    return [];
                }
                const seatConfigIds = getSeatConfigIdByPricingId({
                    scheduleInfo: scheduleInfo.value,
                    pricings: pricingGroup.pricings,
                    currency: props.currency,
                    billingPeriod: props.billingPeriod,
                });
                return seatConfigIds.size ? [[pricingGroup.id, seatConfigIds] as const] : [];
            }),
        ),
);

const groupSeatConfigIds = computed(
    () => new Set([...seatConfigIdsByGroupId.value.values()].flatMap((ids) => [...ids.values()])),
);

const standaloneSeatsModel = computed({
    get: () =>
        seatsModel.value.filter(
            ({ pricing_item_config_id }) => !groupSeatConfigIds.value.has(pricing_item_config_id),
        ),
    set: (value) => {
        seatsModel.value = seatsModel.value
            .filter(({ pricing_item_config_id }) =>
                groupSeatConfigIds.value.has(pricing_item_config_id),
            )
            .concat(value);
    },
});
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
                v-model="standaloneSeatsModel"
                class="sv-plan-customization__seats"
                :initial-seats-values="initialSeatsValues"
                :pricings="meterPricings"
            />

            <!-- one-off flat item units -->
            <UnitsEditor
                v-model="unitsModel"
                class="sv-plan-customization__units"
                :initial-units-values="initialUnitsValues"
                :pricings="meterPricings"
            />

            <!-- pricing group level addons-->
            <template v-for="pricingGroup in pricingGroups" :key="pricingGroup.id">
                <PricingGroupSeatsEditor
                    v-if="seatConfigIdsByGroupId.has(pricingGroup.id)"
                    v-model="enabledPricingIdsModel"
                    v-model:seats-values="seatsModel"
                    class="sv-plan-customization__group"
                    :group-name="pricingGroup.name"
                    :pricings="pricingGroup.pricings"
                    :seat-config-id-by-pricing-id="seatConfigIdsByGroupId.get(pricingGroup.id)!"
                    :initial-seats-values="initialSeatsValues"
                    :billing-period="billingPeriod"
                    :currency="currency"
                />

                <PricingGroupSingleEditor
                    v-else-if="pricingGroup.selection_constraint === 'EXACTLY_ONE'"
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
