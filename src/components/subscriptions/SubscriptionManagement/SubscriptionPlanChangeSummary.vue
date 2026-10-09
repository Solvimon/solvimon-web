<script setup lang="ts">
import { computed } from 'vue';
import { Section, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { SubscriptionPlanChangeSummaryProps } from './SubscriptionPlanChangeSummary.types';

const props = defineProps<SubscriptionPlanChangeSummaryProps>();

const { $t } = useIntl();

const headline = computed(() =>
    $t(
        {
            defaultMessage: 'Moving to {plan}',
            id: 'subscription_management.plan_change_summary.headline',
            description: 'Names the plan a subscription is about to be moved to',
        },
        { plan: props.planName },
    ),
);

/**
 * When the move lands, in the group's own terms. What it costs is left out on purpose: a plan
 * change is not priced up front the way an added pricing is, so the amounts come with the invoice
 * the move is billed on.
 */
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
    <Section
        class="sv-subscription-plan-change-summary"
        :title="
            $t({
                defaultMessage: 'Your new plan',
                id: 'subscription_management.plan_change_summary.title',
                description: 'Title of the block explaining the plan change about to be committed',
            })
        "
    >
        <div class="grid grid-cols-1 gap-1">
            <Typography
                variant="body-sm"
                weight="semibold"
                tag="div"
                class="sv-subscription-plan-change-summary__headline"
            >
                {{ headline }}
            </Typography>
            <Typography
                variant="body-sm"
                color="subtle"
                tag="div"
                class="sv-subscription-plan-change-summary__timing"
            >
                {{ timing }}
            </Typography>
        </div>
    </Section>
</template>
