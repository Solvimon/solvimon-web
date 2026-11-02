<script setup lang="ts">
import { computed } from 'vue';
import { Alert, useIntl } from '@solvimon/solvimon-ui';
import type { SubscriptionCancellationSuccessProps } from './SubscriptionCancellationSuccess.types';

const props = defineProps<SubscriptionCancellationSuccessProps>();

const { $t } = useIntl();

const message = computed(() =>
    props.variant === 'RENEW'
        ? $t({
              defaultMessage: 'Your subscription has been renewed.',
              id: 'subscription_details.renew_success',
              description: 'Confirmation shown after a cancellation has been undone',
          })
        : $t({
              defaultMessage:
                  'Your subscription has been cancelled. You keep access until the end of the billing period.',
              id: 'subscription_details.cancel_success',
              description: 'Confirmation shown after a subscription has been cancelled',
          }),
);
</script>

<template>
    <Alert type="success" :title="message" />
</template>
