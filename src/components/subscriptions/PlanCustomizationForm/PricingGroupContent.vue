<script setup lang="ts">
import { Typography } from '@solvimon/ui';
import type { PricingGroupContentProps } from './PricingGroupContent.types';

defineProps<PricingGroupContentProps>();
</script>
sc

<template>
    <div class="flex gap-4">
        <div class="flex flex-col grow">
            <Typography tag="span" variant="body-sm" weight="semibold">{{ name }}</Typography>
            <Typography tag="span" variant="body-xs" shade="lighter">{{ description }}</Typography>
        </div>
        <div class="flex items-center">
            <slot name="default" />
        </div>
    </div>
</template>
