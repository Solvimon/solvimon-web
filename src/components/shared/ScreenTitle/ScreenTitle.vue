<script setup lang="ts">
import { Typography } from '@solvimon/solvimon-ui';
import type { ScreenTitleProps } from './ScreenTitle.types';

defineProps<ScreenTitleProps>();
</script>

<template>
    <div class="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        <div>
            <Typography variant="heading-1">{{ title }}</Typography>
            <Typography v-if="description" variant="body-sm" shade="lighter">{{
                description
            }}</Typography>
        </div>
        <div v-if="$slots.right"><slot name="right" /></div>
    </div>
</template>
