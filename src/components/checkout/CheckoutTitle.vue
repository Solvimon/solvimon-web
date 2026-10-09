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
import { computed } from 'vue';
import type { CheckoutTitleProps } from './CheckoutTitle.types';

const props = defineProps<CheckoutTitleProps>();

const { $t } = useIntl();

const periodName = computed(() =>
    formatBillingPeriod(props.billingPeriod, { short: true, hideValueForExactPeriods: true }),
);

const strong = (text: string) => `<strong>${text}</strong>`;

/**
 * What the customer is told they are agreeing to.
 *
 * A plan that only subscribes has one amount to state, and states it as it always has. One that
 * also charges something once — hardware, shipping, a swap — has two, and saying the first of
 * them "per month" is a price the customer never agreed to.
 */
const description = computed(() => {
    const dueToday = formatAmount(props.dueTodayAmount);

    if (props.recurringAmount) {
        if (Number(props.recurringAmount.quantity) === 0) {
            return $t(
                {
                    defaultMessage: 'You will be billed <strong>{due_today}</strong> today.',
                    id: 'checkout.one_off_description',
                    description:
                        'The description of an order that is charged once and does not renew',
                },
                // @ts-expect-error the intl values type takes no rich-text tag handler
                { due_today: dueToday, strong },
            );
        }

        const price = formatAmount(props.recurringAmount);

        return props.trialStartDate
            ? $t(
                  {
                      defaultMessage:
                          'You will be billed <strong>{due_today}</strong> today, then <strong>{price}</strong> per {period_name}, starting {startDate, date, long}.',
                      id: 'checkout.trial_period_description_with_one_off',
                      description:
                          'The description of a trial whose first invoice also charges something only once',
                  },
                  {
                      due_today: dueToday,
                      price,
                      period_name: periodName.value,
                      // @ts-expect-error formatjs does not support this type yet
                      startDate: props.subscriptionStartDate,
                      // @ts-expect-error the intl values type takes no rich-text tag handler
                      strong,
                  },
              )
            : $t(
                  {
                      defaultMessage:
                          'You will be billed <strong>{due_today}</strong> today, then <strong>{price}</strong> per {period_name}.',
                      id: 'checkout.subscription_description_with_one_off',
                      description:
                          'The description of a subscription whose first invoice also charges something only once',
                  },
                  // @ts-expect-error the intl values type takes no rich-text tag handler
                  { due_today: dueToday, price, period_name: periodName.value, strong },
              );
    }

    const price = formatAmount(props.amount);

    return props.trialStartDate
        ? $t(
              {
                  defaultMessage:
                      'You will be billed <strong>{price}</strong> per {period_name}, starting {startDate, date, long}.',
                  id: 'checkout.trial_period_description',
                  description: 'The description of the trial period',
              },
              {
                  price,
                  // @ts-expect-error formatjs does not support this type yet
                  startDate: props.subscriptionStartDate,
                  period_name: periodName.value,
                  // @ts-expect-error the intl values type takes no rich-text tag handler
                  strong,
              },
          )
        : $t(
              {
                  defaultMessage:
                      'You will be billed <strong>{price}</strong> per {period_name}, starting today.',
                  id: 'checkout.subscription_description',
                  description: 'The description of the subscription',
              },
              // @ts-expect-error the intl values type takes no rich-text tag handler
              { price, period_name: periodName.value, strong },
          );
});

/** The same sentence with the price still being worked out, so only the period is named. */
const descriptionWithoutPrice = computed(() =>
    props.trialStartDate
        ? $t(
              {
                  defaultMessage: 'per {period_name} starting, {startDate, date, long}',
                  id: 'checkout.trial_period_description_without_price',
                  description:
                      'The description of the trial period, while the price is still being determined',
              },
              {
                  // @ts-expect-error formatjs does not support this type yet
                  startDate: props.subscriptionStartDate,
                  period_name: periodName.value,
              },
          )
        : $t(
              {
                  defaultMessage: 'per {period_name}, starting today',
                  id: 'checkout.subscription_description_without_price',
                  description:
                      'The description of the subscription, while the price is still being determined',
              },
              { period_name: periodName.value },
          ),
);
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
        <Typography variant="body-sm" color="subtle" no-spacing>
            <span v-if="!countryCode" class="flex items-center">
                <Tooltip is-dark-mode>
                    <Skeleton
                        width-class="w-10"
                        height-class="h-4"
                        shade="darker"
                        class="mr-1.5 inline-block"
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
                <span v-html="descriptionWithoutPrice" />
            </span>
            <span v-else v-html="description" />
        </Typography>
    </div>
</template>
