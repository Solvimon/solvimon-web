<script setup lang="ts">
import type { ConfiguredMeterValue, Pricing, PricingExtended } from '@solvimon/solvimon-types';
import { Button, isEqual, Section, StepInput, useIntl } from '@solvimon/solvimon-ui';
import { computed, toRef, watch } from 'vue';
import PricingGroupTitle from './PricingGroupTitle.vue';
import { usePricingDescription } from './usePricingDescription';
import PricingGroupContent from './PricingGroupContent.vue';
import type { PricingGroupEditorBaseProps } from './PricingGroupEditorBase.types';
import { getNameFromPricing } from '@/utils/pricing';
import {
    getAddonMinimumQuantity,
    getAddonQuantity,
    setAddonQuantity,
    type AddonSelection,
} from '@/utils/addonQuantity';

const props = defineProps<
    Omit<PricingGroupEditorBaseProps, 'groupName'> & {
        groupName?: string;
        /** The add-ons bought in a quantity; the others are a toggle. */
        quantityPricingIds?: Pricing['id'][];
    }
>();
const model = defineModel<Pricing['id'][]>('modelValue', { required: true });
const seatsModel = defineModel<ConfiguredMeterValue[]>('seatsValues', { default: () => [] });
const unitsModel = defineModel<ConfiguredMeterValue[]>('unitsValues', { default: () => [] });

const { $t } = useIntl();
const { describePricing } = usePricingDescription({
    currency: toRef(props, 'currency'),
    billingPeriod: toRef(props, 'billingPeriod'),
});

const isSelected = (pricingId: Pricing['id']) => {
    return model.value.includes(pricingId);
};

const selection = () => ({
    enabledPricingIds: model.value,
    seatsValues: seatsModel.value,
    unitsValues: unitsModel.value,
});

const offer = computed(() => ({ currency: props.currency, billingPeriod: props.billingPeriod }));

const quantityAddons = computed(() =>
    props.pricings.filter((pricing) => props.quantityPricingIds?.includes(pricing.id)),
);

const minimums = computed(
    () =>
        new Map(
            quantityAddons.value.map((pricing) => [
                pricing.id,
                getAddonMinimumQuantity(pricing, offer.value),
            ]),
        ),
);

const minimumOf = (pricing: PricingExtended) => minimums.value.get(pricing.id) ?? 1;

const quantityOf = (pricing: PricingExtended) =>
    getAddonQuantity(pricing, selection()) ?? minimumOf(pricing);

// Only what changed is written, so the fill-in below cannot keep triggering itself.
const write = (next: AddonSelection) => {
    if (!isEqual(model.value, next.enabledPricingIds)) model.value = next.enabledPricingIds;
    if (!isEqual(seatsModel.value, next.seatsValues)) seatsModel.value = next.seatsValues;
    if (!isEqual(unitsModel.value, next.unitsValues)) unitsModel.value = next.unitsValues;
};

const handleQuantity = (pricing: PricingExtended, quantity: number) =>
    write(setAddonQuantity(pricing, quantity, selection(), offer.value));

// Typing emits every keystroke and falls back to the minimum on blur, so a number below it is one
// still being typed; only the stepper's remove takes the add-on out.
const handleStep = (pricing: PricingExtended, quantity: number) => {
    if (quantity >= minimumOf(pricing)) handleQuantity(pricing, quantity);
};

// An add-on in the order without a quantity on offer, preselected by the host or after the
// currency or billing period changed, is given its minimum, so what is shown is what is sent.
watch(
    () =>
        quantityAddons.value.filter(
            (pricing) => getAddonQuantity(pricing, selection()) === undefined,
        ),
    (missing) => {
        if (!missing.length) return;
        // The models take a write only once the parent re-renders, so all of them go in one.
        write(
            missing.reduce(
                (next, pricing) => setAddonQuantity(pricing, minimumOf(pricing), next, offer.value),
                selection(),
            ),
        );
    },
    { immediate: true },
);

const handleToggle = (pricingId: Pricing['id']) => {
    if (isSelected(pricingId)) {
        model.value = model.value.filter((id) => id !== pricingId);
    } else {
        model.value = [...model.value, pricingId];
    }
};
</script>

<template>
    <Section no-spacing :no-border="!groupName" :content-background="groupName ? 'gray' : 'none'">
        <div class="grid grid-cols-1 gap-1" :class="{ 'p-1': groupName }">
            <PricingGroupTitle v-if="groupName">
                <template #title>{{ groupName }}</template>
                <template #description>{{
                    $t({
                        defaultMessage: 'Select any number of products',
                        id: 'addon_multiple_editor.description',
                        description: 'The description of the addon multiple editor',
                    })
                }}</template>
            </PricingGroupTitle>

            <div class="grid grid-cols-1 gap-1">
                <template v-for="pricing in pricings" :key="pricing.id">
                    <Section
                        :content-background="groupName || isSelected(pricing.id) ? 'none' : 'gray'"
                        :class="{ '!bg-white': isSelected(pricing.id) }"
                    >
                        <PricingGroupContent
                            :name="getNameFromPricing(pricing) ?? ''"
                            :description="describePricing(pricing)"
                        >
                            <template #default>
                                <div
                                    v-if="minimums.has(pricing.id) && isSelected(pricing.id)"
                                    class="w-24 shrink-0 md:w-32"
                                >
                                    <StepInput
                                        :model-value="quantityOf(pricing)"
                                        size="sm"
                                        :min="minimumOf(pricing)"
                                        removable
                                        @update:model-value="handleStep(pricing, $event)"
                                        @remove="handleQuantity(pricing, 0)"
                                    />
                                </div>
                                <Button
                                    v-else-if="isSelected(pricing.id)"
                                    intent="secondary"
                                    square
                                    size="sm"
                                    icon-prefix="remove_shopping_cart"
                                    @click="handleToggle(pricing.id)"
                                />
                                <Button
                                    v-else
                                    intent="primary"
                                    icon-prefix="add"
                                    size="sm"
                                    @click="
                                        minimums.has(pricing.id)
                                            ? handleQuantity(pricing, minimumOf(pricing))
                                            : handleToggle(pricing.id)
                                    "
                                    >{{
                                        $t({
                                            defaultMessage: 'Add to subscription',
                                            id: 'addon_multiple_editor.add_to_subscription_button',
                                            description:
                                                'The button to add a pricing to the subscription',
                                        })
                                    }}</Button
                                >
                            </template>
                        </PricingGroupContent>
                    </Section>
                </template>
            </div>
        </div>
    </Section>
</template>
