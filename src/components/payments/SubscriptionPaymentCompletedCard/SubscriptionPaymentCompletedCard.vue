<script setup lang="ts">
import { Typography, useIntl, Button } from '@solvimon/ui';
import { onMounted } from 'vue';
import type { SubscriptionPaymentCompletedCardProps } from './SubscriptionPaymentCompletedCard.types';
import PaymentFeedbackCard from '@/components/payments/PaymentFeedbackCard/PaymentFeedbackCard.vue';

const props = defineProps<SubscriptionPaymentCompletedCardProps>();

const { $t } = useIntl();

onMounted(() => {
    if (!props.redirectUrl) {
        return;
    }

    window.location.replace(props.redirectUrl);
});
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
            v-if="redirectUrl"
            :to="redirectUrl"
            color="gray"
            variant="outline"
            size="xs"
            class="align-center"
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
