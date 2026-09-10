<script setup lang="ts">
import { Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { PaymentMethodsUnavailableCardProps } from './PaymentMethodsUnavailableCard.types';
import PaymentFeedbackCard from '@/components/payments/PaymentFeedbackCard/PaymentFeedbackCard.vue';

const props = defineProps<PaymentMethodsUnavailableCardProps>();

const { $t } = useIntl();

// No retry anywhere in here: nothing the customer does from this screen changes the answer.
const title = computed(() =>
    props.variant === 'AUTHORIZE'
        ? $t({
              defaultMessage: 'This invoice cannot be paid online',
              description:
                  'Title shown when no payment method can be offered for paying an invoice',
              id: 'payment_methods_unavailable_card.title.authorize',
          })
        : $t({
              defaultMessage: 'No payment methods can be added',
              description:
                  'Title shown when no payment method can be offered for storing a payment method',
              id: 'payment_methods_unavailable_card.title.tokenize',
          }),
);

const description = computed(() => {
    if (props.variant === 'AUTHORIZE') {
        return props.sellerName
            ? $t(
                  {
                      defaultMessage:
                          'Online payment is not set up for this invoice. {sellerName} can settle it with you directly.',
                      description:
                          'Body text shown when an invoice cannot be paid online, naming the seller',
                      id: 'payment_methods_unavailable_card.description.authorize_with_seller',
                  },
                  { sellerName: props.sellerName },
              )
            : $t({
                  defaultMessage:
                      'Online payment is not set up for this invoice. The party that issued it can settle it with you directly.',
                  description: 'Body text shown when an invoice cannot be paid online',
                  id: 'payment_methods_unavailable_card.description.authorize',
              });
    }

    return props.sellerName
        ? $t(
              {
                  defaultMessage:
                      'No online payment methods are set up. {sellerName} can arrange payment with you directly.',
                  description:
                      'Body text shown when no payment method can be stored, naming the seller',
                  id: 'payment_methods_unavailable_card.description.tokenize_with_seller',
              },
              { sellerName: props.sellerName },
          )
        : $t({
              defaultMessage: 'No online payment methods are set up.',
              description: 'Body text shown when no payment method can be stored',
              id: 'payment_methods_unavailable_card.description.tokenize',
          });
});
</script>

<template>
    <PaymentFeedbackCard
        status="error"
        :title="title"
        class="sv-payment-methods-unavailable-card"
        data-testid="payment-methods-unavailable"
    >
        <div class="flex flex-col items-center gap-4">
            <Typography variant="body-xs" shade="lighter" class="mt-3">{{
                description
            }}</Typography>
            <slot name="default" />
        </div>
    </PaymentFeedbackCard>
</template>
