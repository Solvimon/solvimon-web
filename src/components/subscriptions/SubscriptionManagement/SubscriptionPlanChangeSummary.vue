<script setup lang="ts">
import { computed } from 'vue';
import { Icon, Section, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { SubscriptionPlanChangeSummaryProps } from './SubscriptionPlanChangeSummary.types';

const props = defineProps<SubscriptionPlanChangeSummaryProps>();

const { $t } = useIntl();

const timing = computed(() =>
    props.changeType === 'NEXT_BILLING_PERIOD'
        ? $t({
              defaultMessage:
                  'The change takes effect at the start of your next billing period. You keep your current plan until then, and the new price appears on the invoice from that period onwards.',
              id: 'subscription_management.plan_change_summary.next_billing_period',
              description:
                  'Explains a plan change that only takes effect at the next billing period',
          })
        : $t({
              defaultMessage:
                  'The change takes effect right away. The new price appears on your next invoice.',
              id: 'subscription_management.plan_change_summary.immediate',
              description: 'Explains a plan change that takes effect immediately',
          }),
);
</script>

<template>
    <Section no-spacing class="sv-subscription-plan-change-summary">
        <div class="flex flex-row gap-2 px-3 py-2">
            <Icon icon="info" size="xs" class="mt-0.5 shrink-0 text-secondary" />
            <Typography
                variant="body-xs"
                color="secondary"
                tag="div"
                no-spacing
                class="sv-subscription-plan-change-summary__timing"
            >
                {{ timing }}
            </Typography>
        </div>
    </Section>
</template>
