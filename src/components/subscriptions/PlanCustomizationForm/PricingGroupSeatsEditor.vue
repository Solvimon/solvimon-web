<script setup lang="ts">
import { computed } from 'vue';
import { Section, useIntl } from '@solvimon/solvimon-ui';
import type { ConfiguredMeterValue, Pricing } from '@solvimon/solvimon-types';
import type { PricingGroupSeatsEditorProps } from './PricingGroupSeatsEditor.types';
import PricingGroupTitle from './PricingGroupTitle.vue';
import PricingGroupSeatsOption from './PricingGroupSeatsOption.vue';

const props = defineProps<PricingGroupSeatsEditorProps>();
const model = defineModel<Pricing['id'][]>('modelValue', { required: true });
const seatsModel = defineModel<ConfiguredMeterValue[]>('seatsValues', { required: true });

const { $t } = useIntl();

const groupPricingIds = computed(() => props.pricings.map((pricing) => pricing.id));

const select = (pricingId: Pricing['id']) => {
    model.value = [...model.value.filter((id) => !groupPricingIds.value.includes(id)), pricingId];
};

const findByConfig = (values: ConfiguredMeterValue[] | undefined, configId: string | undefined) =>
    configId ? values?.find((value) => value.pricing_item_config_id === configId) : undefined;

const seatsOf = (pricingId: Pricing['id']) => {
    const configId = props.seatConfigIdByPricingId.get(pricingId);

    return computed({
        get: () => findByConfig(seatsModel.value, configId),
        set: (value) => {
            if (value) {
                seatsModel.value = seatsModel.value.map((seats) =>
                    seats.pricing_item_config_id === configId ? value : seats,
                );
            }
        },
    });
};
</script>

<template>
    <Section no-spacing>
        <div class="p-1">
            <PricingGroupTitle>
                <template #title>{{ groupName }}</template>
                <template #description>{{
                    $t({
                        defaultMessage: 'Select one',
                        id: 'pricing_group_seats_editor.description.exactly_one',
                        description:
                            'The description of a pricing group of seat-based products of which exactly one is picked',
                    })
                }}</template>
            </PricingGroupTitle>

            <div role="radiogroup" :aria-label="groupName" class="grid grid-cols-1 gap-1 pt-1">
                <PricingGroupSeatsOption
                    v-for="pricing in pricings"
                    :key="pricing.id"
                    v-model:seats="seatsOf(pricing.id).value"
                    :pricing="pricing"
                    :seat-config-id="seatConfigIdByPricingId.get(pricing.id)"
                    :selected="model.includes(pricing.id)"
                    :billing-period="billingPeriod"
                    :default-value="
                        findByConfig(initialSeatsValues, seatConfigIdByPricingId.get(pricing.id))
                    "
                    @select="select(pricing.id)"
                />
            </div>
        </div>
    </Section>
</template>
