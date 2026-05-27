<script setup lang="ts">
import {
    formatAmount,
    formatBillingPeriod,
    Skeleton,
    Tooltip,
    TooltipContent,
    TooltipParagraph,
    TrialChip,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import type { CheckoutTitleProps } from './CheckoutTitle.types';

defineProps<CheckoutTitleProps>();

const { $t } = useIntl();
</script>

<template>
    <div>
        <div>
            <Typography variant="heading-1" class="inline-block"
                >{{
                    trialStartDate
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
            <span v-if="!countryCode" class="flex items-center">
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
                                    defaultMessage:
                                        'Will be determined by billing information',
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
                        trialStartDate
                            ? $t(
                                  {
                                      defaultMessage:
                                          'per {period_name} starting, {startDate, date, long}',
                                      id: 'checkout.trial_period_description',
                                      description: 'The description of the trial period',
                                  },
                                  {
                                      // @ts-expect-error formatjs does not support this type yet
                                      startDate: subscriptionStartDate,
                                      period_name: formatBillingPeriod(billingPeriod, {
                                          short: true,
                                          hideValueForExactPeriods: true,
                                      }),
                                  },
                              )
                            : $t(
                                  {
                                      defaultMessage:
                                          'per {period_name}, starting today',
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
                    trialStartDate
                        ? $t(
                              {
                                  defaultMessage:
                                      'You will be billed <strong>{price}</strong> per {period_name}, starting {startDate, date, long}.',
                                  id: 'checkout.trial_period_description',
                                  description: 'The description of the trial period',
                              },
                              {
                                  price: formatAmount(amount),
                                  // @ts-expect-error formatjs does not support this type yet
                                  startDate: subscriptionStartDate,
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
                                      'You will be billed <strong>{price}</strong> per {period_name}, starting today.',
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
    </div>
</template>
