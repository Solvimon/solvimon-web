<script setup lang="ts">
import { Section, useIntl } from '@solvimon/ui';
import SeatsEditor from './SeatsEditor.vue';
import type { ConfiguredMeterValue, Pricing } from '@solvimon/types';
import type { PlanCustomizationEditorProps } from './PlanCustomizationEditor.types';
import AddonSingleEditor from './AddonSingleEditor.vue';
import AddonMultipleEditor from './AddonMultipleEditor.vue';
import PricingGroupSingleEditor from './PricingGroupSingleEditor.vue';
import PricingGroupMultipleEditor from './PricingGroupMultipleEditor.vue';

defineProps<PlanCustomizationEditorProps>();
const seatsModel = defineModel<ConfiguredMeterValue[]>('seatsValues', { required: true });
const enabledPricingIdsModel = defineModel<Pricing['id'][]>('enabledPricingIds', {
    required: true,
});

const { $t } = useIntl();
</script>

<template>
    <Section
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
        <div class="grid grid-cols-1 gap-1">
            <!-- seats-->
            <SeatsEditor
                v-model="seatsModel"
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
                    :group-name="pricingGroup.name"
                    :pricings="pricingGroup.pricings"
                />

                <PricingGroupMultipleEditor
                    v-else-if="
                        pricingGroup.product_type === 'DEFAULT' &&
                        pricingGroup.selection_constraint === 'AT_LEAST_ONE'
                    "
                    v-model="enabledPricingIdsModel"
                    :group-name="pricingGroup.name"
                    :pricings="pricingGroup.pricings"
                />

                <AddonSingleEditor
                    v-else-if="
                        pricingGroup.product_type === 'ADDON' &&
                        pricingGroup.selection_constraint === 'AT_MOST_ONE'
                    "
                    v-model="enabledPricingIdsModel"
                    :group-name="pricingGroup.name"
                    :pricings="pricingGroup.pricings"
                    :constraint="pricingGroup.selection_constraint"
                />

                <AddonMultipleEditor
                    v-else-if="
                        pricingGroup.product_type === 'ADDON' &&
                        pricingGroup.selection_constraint === 'ANY'
                    "
                    v-model="enabledPricingIdsModel"
                    :pricings="pricingGroup.pricings"
                    :group-name="pricingGroup.name"
                />
            </template>

            <!-- product level addons -->
            <AddonMultipleEditor v-model="enabledPricingIdsModel" :pricings="pricings" />
        </div>
    </Section>
</template>
