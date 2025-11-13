<script setup lang="ts">
import { formatAmount, Icon, Typography, useIntl } from '@solvimon/ui';
import { computed } from 'vue';
import type { PaymentCompletedCardProps } from './PaymentCompletedCard.types';
import PaymentFeedbackCard from '@/components/payments/PaymentFeedbackCard/PaymentFeedbackCard.vue';

const props = defineProps<PaymentCompletedCardProps>();

const { $t } = useIntl();

const title = computed(() =>
    props.variant === 'AUTHORIZE'
        ? $t({
              defaultMessage: 'Payment successful',
              description: 'The title for when a payment has been successful',
              id: 'payment_completed_card.title.authorize',
          })
        : $t({
              defaultMessage: 'Your payment method is added',
              description: 'The title for when a payment method was successfully added',
              id: 'payment_completed_card.title.tokenize',
          }),
);
</script>

<template>
    <PaymentFeedbackCard status="success" :title="title">
        <Typography v-if="amount" variant="body-sm" class="mt-1">
            <Icon icon="check" />{{ formatAmount(amount) }}
        </Typography>
        <Typography variant="body-xs" shade="lighter">{{
            $t({
                defaultMessage: 'You are being redirected...',
                description: 'The text shown after a successful message before a redirect',
                id: 'payment_completed_card.redirect_message',
            })
        }}</Typography>
    </PaymentFeedbackCard>
</template>
