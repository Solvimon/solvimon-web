<script setup lang="ts">
import type { TieredTableProps } from './TieredTable.types';
import TieredTableRow from './TieredTableRow.vue';

defineProps<TieredTableProps>();
</script>

<template>
    <div class="grid grid-cols-1 gap-0.5 pt-1.5">
        <TieredTableRow
            v-for="(band, index) in bands"
            :key="index"
            :band="band"
            :is-first="index === 0"
            :previous-band="index > 0 ? bands[index - 1] : undefined"
            :period="period"
        />
    </div>
</template>
