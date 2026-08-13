<script setup lang="ts">
import { computed } from 'vue';
import type { ConfiguredMeterValue } from '@solvimon/solvimon-types';
import { Section } from '@solvimon/solvimon-ui';
import type { SeatsEditorProps } from './SeatsEditor.types';
import SeatsEditorItem from './SeatsEditorItem.vue';

defineProps<SeatsEditorProps>();
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
    <!-- Single root so fallthrough attributes are inherited; the grid mirrors the
         parent's own so the sections keep the same spacing as when they were siblings. -->
    <div v-if="modelValue.length > 0" class="grid grid-cols-1 gap-1">
        <Section v-for="(item, index) in modelValue" :key="index">
            <SeatsEditorItem
                v-if="item.pricing_item_config_id"
                :key="item.pricing_item_config_id"
                v-model="itemModel(index).value"
                :default-value="initialSeatsValues?.[index]"
                :pricings="pricings"
            />
        </Section>
    </div>
</template>
