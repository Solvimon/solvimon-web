<script setup lang="ts">
import { Typography, useIntl, Button } from '@solvimon/solvimon-ui';
import type { SubscriptionPaymentCompletedCardEmits } from './SubscriptionPaymentCompletedCard.types';
import PaymentFeedbackCard from '@/components/payments/PaymentFeedbackCard/PaymentFeedbackCard.vue';

defineEmits<SubscriptionPaymentCompletedCardEmits>();

const { $t } = useIntl();
</script>

<template>
    <PaymentFeedbackCard
        status="success"
        :title="
            $t({
                defaultMessage: 'Payment successful',
                id: 'subscription_payment_completed_card.title',
                description: 'The title for when a payment has been successful',
            })
        "
    >
        <Typography variant="body-xs" shade="lighter" tag="span">
            {{
                $t({
                    defaultMessage: 'Thank you for subscribing.',
                    id: 'subscription_payment_completed_card.thank_you_for_subscribing',
                    description: 'The text shown after a successful message before a redirect',
                })
            }}
        </Typography>
        <Button
            color="gray"
            variant="outline"
            size="xs"
            class="align-center"
            @click="$emit('continue-to-merchant')"
        >
            {{
                $t({
                    defaultMessage: 'Continue to merchant',
                    id: 'subscription_payment_completed_card.continue',
                    description: 'The text for the continue button',
                })
            }}
        </Button>
    </PaymentFeedbackCard>
</template>
