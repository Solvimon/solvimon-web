<script setup lang="ts">
import { Icon, Section, Typography } from '@solvimon/solvimon-ui';
import type { EmptyStatePlaceholderProps } from './EmptyStatePlaceholder.types';

defineProps<EmptyStatePlaceholderProps>();
</script>

<template>
    <Section class="sv-empty-state">
        <div class="sv-empty-state__body flex flex-col items-center justify-center py-4">
            <Icon :icon="icon" size="lg" class="sv-empty-state__icon text-gray-500" />
            <Typography
                center
                tag="span"
                variant="body-sm"
                weight="semibold"
                shade="lighter"
                class="sv-empty-state__title mt-2"
            >
                <slot name="title" />
            </Typography>
            <Typography
                center
                tag="span"
                variant="body-xs"
                shade="lightest"
                class="sv-empty-state__message mt-1"
            >
                <slot name="message" />
            </Typography>
        </div>
    </Section>
</template>
