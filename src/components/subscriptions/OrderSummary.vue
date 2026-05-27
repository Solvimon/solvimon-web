<script setup lang="ts">
import {
    InvoicePreview,
    InvoicePreviewGroups,
    Section,
    SelectExtended,
    Toggle,
    Typography,
    Chip,
    formatAmount,
    useIntl,
    useTimePeriod,
    type SelectExtendedOptionEntry,
} from '@solvimon/solvimon-ui';
import type { BillingPeriod, Pricing } from '@solvimon/solvimon-types';
import { computed } from 'vue';
import SubscriptionSummary from './SubscriptionSummary.vue';
import type { OrderSummaryProps } from './OrderSummary.types';
import PricingGroupContent from '@/components/subscriptions/PlanCustomizationForm/PricingGroupContent.vue';
import { useViewport } from '@/composables/useViewport';
import { getFirstPricingPlanScheduleOfType } from '@/utils/pricingPlanSchedule';

const props = defineProps<OrderSummaryProps>();
const emit = defineEmits<{
    (event: 'billing-period-change', billingPeriod: BillingPeriod): void;
}>();

const { $t } = useIntl();
const { map, formatTimePeriod } = useTimePeriod();
const { isMobileViewport } = useViewport();
const saveBadgeSize = computed(() => (isMobileViewport.value ? 'sm' : 'xs'));

const getBillingPeriodKey = (period: BillingPeriod) => `${period.type}:${period.value}`;

const BILLING_PERIOD_TYPES: string[] = ['DAY', 'WEEK', 'MONTH', 'YEAR'];
const isBillingPeriodType = (value: string): value is BillingPeriod['type'] =>
    BILLING_PERIOD_TYPES.includes(value);

// Billing period keys are serialized as "TYPE:VALUE" (e.g. "MONTH:3") and parse to { type: 'MONTH', value: 3 }.
const parseBillingPeriodKey = (key?: string): BillingPeriod | undefined => {
    if (!key) {
        return undefined;
    }
    const [type, rawValue] = key.split(':');
    const numericValue = Number(rawValue);
    if (!numericValue || !isBillingPeriodType(type)) {
        return undefined;
    }
    return { type, value: numericValue };
};

const selectedBillingPeriodKey = computed<string | undefined>({
    get: () => {
        const period = props.subscription.billing_period;
        return period ? `${period.type}:${period.value}` : undefined;
    },
    set: (value) => {
        if (!value) return;
        const [type, rawValue] = value.split(':');
        const numericValue = Number(rawValue);
        if (!numericValue) return;
        if (!isBillingPeriodType(type)) return;
        emit('billing-period-change', { type, value: numericValue });
    },
});

const getSelectedPeriodAmountLabel = (period: BillingPeriod) => {
    const amount =
        props.invoicePreviewByBillingPeriod?.[getBillingPeriodKey(period)]?.periods?.[0]
            ?.amount_including_tax;
    if (!amount) {
        return undefined;
    }
    const periodLabel =
        period.type === 'MONTH' && period.value === 3
            ? $t({
                  defaultMessage: '/quarter',
                  id: 'checkout.order_summary_block.billing_period.per_quarter',
                  description: 'Period label for quarterly billing',
              })
            : $t(
                  {
                      defaultMessage: '/{period}',
                      id: 'checkout.order_summary_block.billing_period.per_label',
                      description: 'Period label for billing cycles',
                  },
                  {
                      period: formatTimePeriod(period, {
                          prefix: false,
                          hideValueForExactPeriods: true,
                      }),
                  },
              );
    return $t(
        {
            defaultMessage: '{amount}{period}',
            id: 'checkout.order_summary_block.billing_period.sub_label',
            description: 'Billing period option sublabel showing price per period',
        },
        {
            amount: formatAmount(amount),
            period: periodLabel,
        },
    );
};

const getPeriodTotalAmount = (period: BillingPeriod) =>
    props.invoicePreviewByBillingPeriod?.[getBillingPeriodKey(period)]?.periods?.[0]
        ?.amount_including_tax;

const getAmountValue = (amount: { quantity: string }) => Number(amount.quantity);

// Convert a period amount into its yearly equivalent using fixed day/week/month counts.
const getAnnualizedAmount = (
    period: BillingPeriod,
    amount?: { quantity: string; currency: string },
) => {
    if (!amount) {
        return undefined;
    }
    const base = {
        DAY: 365,
        WEEK: 52,
        MONTH: 12,
        YEAR: 1,
    } as const;
    const multiplier = base[period.type] / Math.max(period.value ?? 1, 1);
    const annualValue = getAmountValue(amount) * multiplier;
    if (!Number.isFinite(annualValue)) {
        return undefined;
    }
    return {
        quantity: annualValue.toFixed(2),
        currency: amount.currency,
    };
};

// calculate the positive difference between two amount
const getSavingsAmount = (
    fromAmount?: { quantity: string; currency: string },
    toAmount?: { quantity: string; currency: string },
) => {
    if (!fromAmount || !toAmount) {
        return undefined;
    }
    const delta = getAmountValue(fromAmount) - getAmountValue(toAmount);
    if (!Number.isFinite(delta) || delta <= 0) {
        return undefined;
    }
    return {
        quantity: delta.toFixed(2),
        currency: fromAmount.currency,
    };
};

// Render a single-line badge label like "Save $X /year".
const getSaveBadgeText = (amount?: { quantity: string; currency: string }) => {
    if (!amount) {
        return undefined;
    }
    const saveLine = $t(
        {
            defaultMessage: 'Save {amount}',
            id: 'checkout.order_summary_block.billing_period.save_badge.prefix',
            description: 'First line for the savings badge label',
        },
        { amount: formatAmount(amount) },
    );
    const periodLine = $t({
        defaultMessage: '/year',
        id: 'checkout.order_summary_block.billing_period.save_badge.suffix',
        description: 'Second line for the savings badge label',
    });
    return `${saveLine}${periodLine}`;
};

const effectiveBillingPeriods = computed<BillingPeriod[]>(() => {
    const scheduleInfo = getFirstPricingPlanScheduleOfType({
        pricingPlanScheduleInfos: props.subscription.pricing_plan_schedule_infos ?? [],
        type: 'DEFAULT',
    });

    const configuredPeriods =
        scheduleInfo?.pricing_plan_version?.billing_period_settings?.billing_periods ?? [];
    const periodByKey = new Map<string, BillingPeriod>();

    const registerPeriod = (period?: BillingPeriod) => {
        if (!period) {
            return;
        }
        periodByKey.set(getBillingPeriodKey(period), period);
    };

    const registerPeriodsFromPricing = (pricing?: Pricing) => {
        pricing?.items?.forEach((item) => {
            item.configs?.forEach((config) => registerPeriod(config.billing_period));
            item.billing_period_configs?.forEach((periodConfig) =>
                registerPeriod(periodConfig.billing_period),
            );
            item.pricing_currency_configs?.forEach((currencyConfig) => {
                currencyConfig.configs?.forEach((config) => registerPeriod(config.billing_period));
                currencyConfig.billing_period_configs?.forEach((periodConfig) =>
                    registerPeriod(periodConfig.billing_period),
                );
            });
        });
    };

    const categories = scheduleInfo?.pricing_plan_version?.pricing_categories ?? [];
    categories.forEach((category) => {
        category.pricings?.forEach((pricing) => registerPeriodsFromPricing(pricing));
        category.pricing_groups?.forEach((group) =>
            group.pricings?.forEach((pricing) => registerPeriodsFromPricing(pricing)),
        );
    });

    if (!periodByKey.size) {
        return [];
    }

    // Keep plan settings order where possible, append any extra periods found on items afterwards.
    const orderedFromSettings = configuredPeriods
        .map((entry) => periodByKey.get(getBillingPeriodKey(entry.period)))
        .filter((period): period is BillingPeriod => !!period);

    const configuredKeys = new Set(orderedFromSettings.map(getBillingPeriodKey));
    const discoveredExtras = [...periodByKey.values()].filter(
        (period) => !configuredKeys.has(getBillingPeriodKey(period)),
    );

    return [...orderedFromSettings, ...discoveredExtras];
});

const billingPeriodOptions = computed<SelectExtendedOptionEntry[]>(() => {
    const biggestPeriod = effectiveBillingPeriods.value[effectiveBillingPeriods.value.length - 1];
    const biggestAnnual = biggestPeriod
        ? getAnnualizedAmount(biggestPeriod, getPeriodTotalAmount(biggestPeriod))
        : undefined;

    const options = effectiveBillingPeriods.value.map((period) => {
        const label =
            period.type === 'MONTH' && period.value === 3
                ? $t({
                      defaultMessage: 'Billed quarterly',
                      id: 'checkout.order_summary_block.billing_period.quarterly',
                      description: 'Billing period option label for quarterly billing',
                  })
                : $t(
                      {
                          defaultMessage: 'Billed {period}',
                          id: 'checkout.order_summary_block.billing_period.label',
                          description: 'Billing period option label for the selected period',
                      },
                      { period: map.value[period.type].full },
                  );

        const optionAmount = getPeriodTotalAmount(period);
        const optionAnnual = getAnnualizedAmount(period, optionAmount);
        const savingsAmount =
            biggestPeriod &&
            period.type === biggestPeriod.type &&
            period.value === biggestPeriod.value
                ? undefined
                : getSavingsAmount(optionAnnual, biggestAnnual);
        const saveText = getSaveBadgeText(savingsAmount);

        return {
            label,
            subLabel: getSelectedPeriodAmountLabel(period),
            labelSuffixComponent: saveText
                ? {
                      component: Chip,
                      props: {
                          color: 'primary',
                          content: saveText,
                          size: saveBadgeSize.value,
                          class: 'whitespace-nowrap text-left leading-tight',
                      },
                  }
                : undefined,
            hidden: selectedBillingPeriodKey.value === `${period.type}:${period.value}`,
            value: `${period.type}:${period.value}`,
        };
    });

    return options;
});

const periodBounds = computed(() => {
    const periods = billingPeriodOptions.value;
    const smallest = periods[0];
    const biggest = periods[periods.length - 1];
    return {
        smallestPeriod: smallest?.value,
        biggestPeriod: biggest?.value,
    };
});

const highOption = computed(() =>
    billingPeriodOptions.value.find((option) => option.value === periodBounds.value.biggestPeriod),
);

const selectedBillingPeriodOption = computed(() =>
    billingPeriodOptions.value.find((option) => option.value === selectedBillingPeriodKey.value),
);

// Show yearly savings on the toggle by comparing the selected period to the biggest period.
const toggleSaveText = computed(() => {
    const options = billingPeriodOptions.value;
    const biggestOption = options[options.length - 1];
    const selectedKey = selectedBillingPeriodKey.value;
    if (!biggestOption || !selectedKey) {
        return '';
    }
    if (selectedKey === biggestOption.value) {
        return '';
    }
    const biggestPeriod = parseBillingPeriodKey(biggestOption.value);
    if (!biggestPeriod) {
        return '';
    }
    const biggestAmount =
        props.invoicePreviewByBillingPeriod?.[biggestOption.value]?.periods?.[0]
            ?.amount_including_tax;
    const selectedPeriod = parseBillingPeriodKey(selectedKey);
    const selectedAmount =
        props.invoicePreviewByBillingPeriod?.[selectedKey]?.periods?.[0]?.amount_including_tax;
    if (!selectedPeriod || !selectedAmount) {
        return '';
    }
    const selectedAnnual = getAnnualizedAmount(selectedPeriod, selectedAmount);
    const biggestAnnual = getAnnualizedAmount(biggestPeriod, biggestAmount);
    return getSaveBadgeText(getSavingsAmount(selectedAnnual, biggestAnnual)) ?? '';
});

const handleBinaryBillingToggle = (checked: boolean) => {
    const { smallestPeriod, biggestPeriod } = periodBounds.value;
    selectedBillingPeriodKey.value = checked ? biggestPeriod : smallestPeriod;
};
</script>

<template>
    <Section
        class="sv-order-summary"
        no-border
        no-spacing
        content-background="none"
        :title="
            noTitle
                ? undefined
                : $t({
                      defaultMessage: 'Order summary',
                      id: 'checkout.order_summary_block.title',
                      description:
                          'The title of the order summary block that lists the subscription cost in the checkout',
                  })
        "
    >
        <div class="sv-order-summary__body grid grid-cols-1 gap-1">
            <!-- subscription summary -->
            <Section no-spacing class="sv-order-summary__subscription">
                <SubscriptionSummary
                    v-if="subscription"
                    :avatar="avatar"
                    :invoice="invoice"
                    :subscription="subscription"
                    :enabled-pricing-ids="enabledPricingIds"
                    :loading="isPreviewAndPaymentMethodsPending"
                    :trial-period="trialPeriod"
                />
            </Section>

            <Section
                v-if="billingPeriodOptions.length === 2"
                no-spacing
                :content-classes="
                    selectedBillingPeriodKey === periodBounds.biggestPeriod
                        ? 'border-primary-500'
                        : undefined
                "
            >
                <div class="px-3 py-2">
                    <div class="sv-order-summary__billing-period flex flex-col gap-3">
                        <PricingGroupContent
                            v-if="highOption"
                            :name="highOption.label"
                            :description="selectedBillingPeriodOption?.subLabel ?? ''"
                        >
                            <template v-if="toggleSaveText" #badge>
                                <Chip
                                    color="primary"
                                    :content="toggleSaveText"
                                    :size="saveBadgeSize"
                                    class="whitespace-nowrap text-left leading-tight"
                                />
                            </template>
                            <template #default>
                                <Toggle
                                    :model-value="
                                        selectedBillingPeriodKey === periodBounds.biggestPeriod
                                    "
                                    @update:model-value="handleBinaryBillingToggle"
                                />
                            </template>
                        </PricingGroupContent>
                    </div>
                </div>
            </Section>

            <!-- billing period selector -->
            <SelectExtended
                v-else-if="billingPeriodOptions.length > 2"
                v-model:single-model-value="selectedBillingPeriodKey"
                class="sv-order-summary__billing-period"
                :options="billingPeriodOptions"
                size="xl"
                has-large-dropdown
                show-sub-label-in-input
                show-suffix-in-closed-input
            />

            <!-- usage based -->
            <Section v-if="isUsageBased" no-spacing class="sv-order-summary__usage">
                <div class="px-3 py-2">
                    <Typography no-spacing variant="body-sm" shade="lighter">
                        {{
                            $t({
                                defaultMessage: '+ Usage',
                                id: 'checkout.invoice_preview.usage_based_message',
                                description:
                                    'The message shown for the usage based invoice preview',
                            })
                        }}
                    </Typography>
                </div>
            </Section>

            <!-- invoice groups preview -->
            <div v-if="invoice && variant !== 'products-inline'" class="sv-order-summary__items">
                <InvoicePreviewGroups :invoice="invoice" :wrapper-component="Section" />
            </div>

            <!-- invoice totals preview -->
            <Section class="sv-order-summary__totals">
                <InvoicePreview
                    v-if="invoice"
                    class="sv-order-summary__invoice-preview"
                    :variant="variant === 'products-inline' ? 'default' : 'without-products'"
                    :invoice="invoice"
                    :trial-invoice="trialInvoice"
                    :is-paid="isPaid"
                    :collapsible="collapsible"
                    :is-preview-without-taxes="!countryCode"
                    is-customer-facing
                />
                <Typography v-else variant="body-sm" shade="lighter" class="sv-order-summary__empty"
                    >{{
                        $t({
                            defaultMessage: 'Please select a country first',
                            description:
                                'The message shown for the invoice preview when no country is set',
                            id: 'checkout.invoice_preview.no_country_selected_message',
                        })
                    }}
                </Typography>
            </Section>
        </div>
    </Section>
</template>
