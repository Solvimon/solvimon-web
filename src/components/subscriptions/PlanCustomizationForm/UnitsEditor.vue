<script setup lang="ts">
import { computed } from 'vue';
import type { ConfiguredMeterValue } from '@solvimon/solvimon-types';
import { Section, useIntl } from '@solvimon/solvimon-ui';
import type { UnitsEditorProps } from './UnitsEditor.types';
import UnitsEditorItem from './UnitsEditorItem.vue';
import PricingGroupTitle from './PricingGroupTitle.vue';

defineProps<UnitsEditorProps>();

const { $t } = useIntl();
const model = defineModel<ConfiguredMeterValue[]>('modelValue', { required: true });

const itemModel = (index: number) =>
    computed({
        get: () => model.value[index],
        set: (value) => {
            const next = model.value.slice();
            next[index] = value;
            model.value = next;
        },
    });
</script>

<template>
    <!-- Single root so fallthrough attributes are inherited. Headed because a stepper of hardware
         looks exactly like a stepper of seats, and only one of the two comes back next month. -->
    <Section v-if="modelValue.length > 0" no-spacing content-background="gray">
        <div class="grid grid-cols-1 gap-1 p-1">
            <PricingGroupTitle>
                <template #title>{{
                    $t({
                        defaultMessage: 'One-time items',
                        id: 'units_editor.title',
                        description:
                            'The heading above the one-off items in the plan customization form',
                    })
                }}</template>
                <template #description>{{
                    $t({
                        defaultMessage: 'Charged once',
                        id: 'units_editor.description',
                        description:
                            'The description of the one-off items in the plan customization form',
                    })
                }}</template>
            </PricingGroupTitle>

            <div class="grid grid-cols-1 gap-1">
                <Section v-for="(item, index) in modelValue" :key="index" content-background="none">
                    <UnitsEditorItem
                        v-if="item.pricing_item_config_id"
                        :key="item.pricing_item_config_id"
                        v-model="itemModel(index).value"
                        :default-value="initialUnitsValues?.[index]"
                        :pricings="pricings"
                    />
                </Section>
            </div>
        </div>
    </Section>
</template>
