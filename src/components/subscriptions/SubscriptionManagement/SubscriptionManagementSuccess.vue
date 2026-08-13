<script setup lang="ts">
import { useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { SubscriptionManagementSuccessProps } from './SubscriptionManagementSuccess.types';
import PaymentFeedbackCard from '@/components/payments/PaymentFeedbackCard/PaymentFeedbackCard.vue';

const props = defineProps<SubscriptionManagementSuccessProps>();

const { $t } = useIntl();

const title = computed(() =>
    $t({
        defaultMessage: 'Subscription updated',
        description: 'Title shown on the manage subscription screen once the change is committed',
        id: 'subscription_management.success.title',
    }),
);

/** Names what was changed where it is known, since a customer may manage several groups. */
const message = computed(() =>
    props.pricingGroupName
        ? $t(
              {
                  defaultMessage:
                      'Your {subject} has been changed. Please be aware that it can take some time to reflect this change in your subscription.',
                  description:
                      'Confirmation of the pricing group a committed subscription change applied to',
                  id: 'subscription_management.success.message',
              },
              { subject: props.pricingGroupName },
          )
        : $t({
              defaultMessage:
                  'Your subscription has been changed. Please be aware that it can take some time to reflect this change in your subscription.',
              description:
                  'Confirmation of a committed subscription change when the pricing group is not known',
              id: 'subscription_management.success.message_generic',
          }),
);
</script>

<template>
    <div class="sv-subscription-management-success grid grid-cols-1 gap-4">
        <PaymentFeedbackCard status="success" :title="title">
            <span class="sv-subscription-management-success__message">{{ message }}</span>
        </PaymentFeedbackCard>
    </div>
</template>
