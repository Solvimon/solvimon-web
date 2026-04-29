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
    <Section v-for="(item, index) in modelValue" :key="index">
        <SeatsEditorItem
            v-if="item.pricing_item_config_id"
            :key="item.pricing_item_config_id"
            v-model="itemModel(index).value"
            :default-value="initialSeatsValues?.[index]"
            :pricings="pricings"
        />
    </Section>
</template>
