<script setup lang="ts">
import {
    formatAmount,
    formatBillingPeriod,
    offsetDateWithTimePeriod,
    Skeleton,
    Tooltip,
    TooltipContent,
    TooltipParagraph,
    TrialChip,
    Typography,
    useIntl,
} from '@solvimon/ui';
import type { CheckoutTitleProps } from './CheckoutTitle.types';

defineProps<CheckoutTitleProps>();

const { $t } = useIntl();
</script>

<template>
    <div>
        <Typography variant="heading-1" class="inline-block"
            >{{
                trialPeriod
                    ? subscriptionName
                    : $t({
                          defaultMessage: 'Pay and subscribe',
                          id: 'checkout.page_title',
                          description: 'The title of the checkout page',
                      })
            }}{{ ' '
            }}<TrialChip
                v-if="trialPeriod"
                :trial-period="trialPeriod"
                size="lg"
                class="-translate-y-0.5"
        /></Typography>
    </div>
    <Typography variant="body-sm" shade="lighter" no-spacing>
        <span class="flex items-center" v-if="!countryCode">
            <Tooltip is-dark-mode>
                <Skeleton
                    width-class="w-10"
                    height-class="h-4"
                    shade="darker"
                    class="inline-block mr-1.5"
                />
                <template #tooltip>
                    <TooltipContent>
                        <TooltipParagraph>{{
                            $t({
                                defaultMessage: 'Will be determined by billing information',
                                description:
                                    'Tooltip content for the invoice preview when taxes are not determined by billing information',
                                id: 'invoice_preview.taxes_not_determined_by_billing_information_tooltip',
                            })
                        }}</TooltipParagraph>
                    </TooltipContent>
                </template>
            </Tooltip>
            <span
                v-html="
                    trialPeriod
                        ? $t(
                              {
                                  defaultMessage:
                                      'per {period_name} starting {startDate, date, long}',
                                  id: 'checkout.trial_period_description',
                                  description: 'The description of the trial period',
                              },
                              {
                                  // TODO: This is the proper type, but formatjs does not support it yet
                                  // @ts-ignore
                                  startDate: offsetDateWithTimePeriod(new Date(), trialPeriod),
                                  period_name: formatBillingPeriod(billingPeriod, {
                                      short: true,
                                      hideValueForExactPeriods: true,
                                  }),
                              },
                          )
                        : $t(
                              {
                                  defaultMessage: 'per {period_name} starting today',
                                  id: 'checkout.subscription_description',
                                  description: 'The description of the subscription',
                              },
                              {
                                  period_name: formatBillingPeriod(billingPeriod, {
                                      short: true,
                                      hideValueForExactPeriods: true,
                                  }),
                              },
                          )
                "
            />
        </span>
        <span
            v-else
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
                              startDate: offsetDateWithTimePeriod(new Date(), trialPeriod),
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
