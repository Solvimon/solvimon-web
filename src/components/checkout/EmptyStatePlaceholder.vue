<script setup lang="ts">
import { Icon, Section, Typography } from '@solvimon/ui';
import type { EmptyStatePlaceholderProps } from './EmptyStatePlaceholder.types';

defineProps<EmptyStatePlaceholderProps>();
</script>

<template>
    <Section>
        <div class="py-4 flex flex-col items-center justify-center">
            <Icon :icon="icon" size="lg" class="text-gray-500" />
            <Typography
                center
                tag="span"
                variant="body-sm"
                weight="semibold"
                shade="lighter"
                class="mt-2"
            >
                <slot name="title" />
            </Typography>
            <Typography center tag="span" variant="body-xs" shade="lightest" class="mt-1">
                <slot name="message" />
            </Typography>
        </div>
    </Section>
</template>
