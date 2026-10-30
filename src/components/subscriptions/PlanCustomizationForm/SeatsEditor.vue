<script setup lang="ts">
import { computed } from 'vue';
import type { ConfiguredMeterValue } from '@solvimon/solvimon-types';
import { Section } from '@solvimon/solvimon-ui';
import type { SeatsEditorProps } from './SeatsEditor.types';
import SeatsEditorItem from './SeatsEditorItem.vue';

const props = defineProps<SeatsEditorProps>();
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

// By config rather than position: the model and the order list it is bounded by may not line up.
const defaultValueFor = (item: ConfiguredMeterValue) =>
    props.initialSeatsValues?.find(
        (value) => value.pricing_item_config_id === item.pricing_item_config_id,
    );

const maxValueFor = (item: ConfiguredMeterValue) =>
    props.maxValues?.find((value) => value.pricing_item_config_id === item.pricing_item_config_id);

const isFixed = (item: ConfiguredMeterValue) =>
    !!props.editableConfigIds && !props.editableConfigIds.includes(item.pricing_item_config_id);
</script>

<template>
    <!-- Single root so fallthrough attributes are inherited; the grid mirrors the
         parent's own so the sections keep the same spacing as when they were siblings. -->
    <div v-if="modelValue.length > 0" class="grid grid-cols-1 gap-1">
        <Section v-for="(item, index) in modelValue" :key="index">
            <SeatsEditorItem
                v-if="item.pricing_item_config_id"
                :key="item.pricing_item_config_id"
                v-model="itemModel(index).value"
                :default-value="defaultValueFor(item)"
                :max-value="maxValueFor(item)"
                :disabled="isFixed(item)"
                :pricings="pricings"
            />
        </Section>
    </div>
</template>
