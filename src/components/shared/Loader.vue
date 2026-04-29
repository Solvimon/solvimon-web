<script setup lang="ts">
import { Spinner } from '@solvimon/solvimon-ui';

withDefaults(
    defineProps<{
        size?: number;
        withSpacing?: boolean;
    }>(),
    { size: 4, withSpacing: false },
);
</script>

<template>
    <div :class="['flex items-center justify-center h-[88px]', { 'p-3 pt-2': withSpacing }]">
        <Spinner :spinner-size="size" />
    </div>
</template>
