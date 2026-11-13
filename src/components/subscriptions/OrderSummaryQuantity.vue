<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipParagraph, Typography } from '@solvimon/solvimon-ui';

/**
 * How many of a product a row charges, in a column as wide as `width`; none keeps the column. A
 * shortened count, such as 7K+, shows its whole number on hover.
 */
defineProps<{ quantity?: { label: string; exact?: string }; width: string }>();
</script>

<template>
    <Tooltip v-if="quantity?.exact" is-dark-mode root-class="shrink-0">
        <Typography
            tag="span"
            variant="body-xs"
            color="inherit"
            class="sv-order-summary__quantity block tabular-nums text-gray-300"
            :style="{ minWidth: width }"
            >{{ quantity.label }}</Typography
        >
        <template #tooltip>
            <TooltipContent>
                <TooltipParagraph>{{ quantity.exact }}</TooltipParagraph>
            </TooltipContent>
        </template>
    </Tooltip>
    <Typography
        v-else
        tag="span"
        variant="body-xs"
        color="inherit"
        class="sv-order-summary__quantity shrink-0 tabular-nums text-gray-300"
        :style="{ minWidth: width }"
        >{{ quantity?.label }}</Typography
    >
</template>
