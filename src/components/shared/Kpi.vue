<script setup lang="ts">
import { Icon, Typography } from '@solvimon/ui';
import type { KpiProps } from './Kpi.types';

defineProps<KpiProps>();
</script>

<template>
    <div class="flex gap-1">
        <Icon :icon="icon" size="xs" />
        <Typography variant="body-xs">{{ kpi }}</Typography>
    </div>
</template>
