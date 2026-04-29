<script setup lang="ts">
import { Typography } from '@solvimon/solvimon-ui';
import type { PricingGroupContentProps } from './PricingGroupContent.types';

defineProps<PricingGroupContentProps>();
</script>

<template>
    <div class="flex items-start">
        <div class="flex flex-col grow">
            <div class="flex items-center gap-1">
                <Typography tag="span" variant="body-sm" weight="semibold">{{ name }}</Typography>
                <slot name="badge" />
            </div>
            <Typography tag="span" variant="body-xs" shade="lighter">{{ description }}</Typography>
        </div>
        <div class="flex items-center ml-4 self-center">
            <slot name="default" />
        </div>
    </div>
</template>
