<script setup lang="ts">
import {
    formatAmount,
    formatBillingPeriod,
    offsetDateWithTimePeriod,
    TrialChip,
    Typography,
    useIntl,
} from '@solvimon/ui';
import type { TimePeriod } from '@solvimon/types';
import type { CheckoutTitleProps } from './CheckoutTitle.types';

defineProps<CheckoutTitleProps>();

const { $t } = useIntl();
</script>

<template>
    <div class="flex gap-3 items-start">
        <Typography variant="heading-1">{{
            trialPeriod
                ? $t(
                      {
                          defaultMessage: 'Try {subscription_name}',
                          id: 'checkout.page_title_with_trial',
                          description: 'The title of the checkout page with a trial period',
                      },
                      { subscription_name: subscriptionName },
                  )
                : $t({
                      defaultMessage: 'Pay and subscribe',
                      id: 'checkout.page_title',
                      description: 'The title of the checkout page',
                  })
        }}</Typography>
        <TrialChip v-if="trialPeriod" :trial-period="trialPeriod" size="lg" class="mt-1" />
    </div>
    <Typography variant="body-sm" shade="lighter" no-spacing>
        <span
            v-html="
                trialPeriod
                    ? $t(
                          {
                              defaultMessage:
                                  '<strong>{price}</strong> per {period_name} starting {startDate, date, long}',
                              id: 'checkout.trial_period_description',
                              description: 'The description of the trial period',
                          },
                          {
                              price: formatAmount(amount),
                              // TODO: This is the proper type, but formatjs does not support it yet
                              // @ts-ignore
                              startDate: offsetDateWithTimePeriod(
                                  offsetDateWithTimePeriod(new Date(), billingPeriod as TimePeriod),
                                  { type: 'DAY', value: 1 },
                              ),
                              period_name: formatBillingPeriod(billingPeriod, {
                                  short: true,
                                  hideValueForExactPeriods: true,
                              }),
                              // @ts-ignore
                              strong: (text) => `<strong>${text}</strong>`,
                          },
                      )
                    : $t(
                          {
                              defaultMessage:
                                  '<strong>{price}</strong> per {period_name} starting today',
                              id: 'checkout.subscription_description',
                              description: 'The description of the subscription',
                          },
                          {
                              price: formatAmount(amount),
                              period_name: formatBillingPeriod(billingPeriod, {
                                  short: true,
                                  hideValueForExactPeriods: true,
                              }),
                              // @ts-ignore
                              strong: (text) => `<strong>${text}</strong>`,
                          },
                      )
            "
        />
    </Typography>
</template>
