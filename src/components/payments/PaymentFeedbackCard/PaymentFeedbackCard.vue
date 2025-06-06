<script setup lang="ts">
import { Icon, Section, Typography } from '@solvimon/ui';
import type { PaymentFeedbackCardProps } from './PaymentFeedbackCard.types';

withDefaults(defineProps<PaymentFeedbackCardProps>(), {
    status: 'success',
});
</script>

<template>
    <Section>
        <div class="flex flex-col items-center py-16">
            <Icon
                :icon="status === 'success' ? 'check_circle' : 'error'"
                class="rounded-full p-4 shadow-lg"
                :class="{
                    'bg-green-400 text-white': status === 'success',
                    'bg-gray-200 text-red-600': status === 'error',
                }"
                size="xl"
            />
            <Typography variant="heading-1" class="mt-8">
                {{ title }}
            </Typography>
            <Typography v-if="$slots.default" tag="div" variant="body-sm" class="mt-1">
                <slot name="default" />
            </Typography>
        </div>
    </Section>
</template>
