<script setup lang="ts">
import { Icon, Section, Typography } from '@solvimon/solvimon-ui';
import type { PaymentFeedbackCardProps } from './PaymentFeedbackCard.types';

withDefaults(defineProps<PaymentFeedbackCardProps>(), {
    status: 'success',
});
</script>

<template>
    <Section>
        <div class="flex flex-col items-center py-10">
            <Icon
                :icon="status === 'success' ? 'check_circle' : 'error'"
                :class="{
                    'text-green-400': status === 'success',
                    'text-red-600': status === 'error',
                }"
                size="lg"
            />
            <Typography variant="heading-3" tag="span" class="mt-2">
                {{ title }}
            </Typography>
            <Typography v-if="$slots.default" tag="div" variant="body-sm">
                <slot name="default" />
            </Typography>
        </div>
    </Section>
</template>
