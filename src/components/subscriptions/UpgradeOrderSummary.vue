<script setup lang="ts">
import { computed } from 'vue';
import {
    Amount,
    Icon,
    InvoicePreview,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import type { Amount as MoneyAmount, Invoice } from '@solvimon/solvimon-types';
import type { OnDemandPricing } from './UpgradeSubscription/UpgradeSubscription.types';

const props = defineProps<{
    selectedPricings: OnDemandPricing[];
    invoice?: Invoice;
    loading?: boolean;
}>();

const { $t } = useIntl();

const isEmpty = computed(() => props.selectedPricings.length === 0);

const getPrice = (pricing: OnDemandPricing) => {
    const band = pricing.items?.[0]?.configs?.[0]?.bands?.[0];
    // Backend uses fixed_amount for FIXED pricing and amount for FLAT pricing.
    return band?.fixed_amount ?? band?.amount;
};

const invoiceHeader = computed(() => {
    const group = props.invoice?.periods?.[0]?.groups?.[0];
    const product = group?.products?.[0];
    const lineCount = invoiceLineRows.value.length;

    return {
        title: product?.name ?? group?.product_category?.name ?? invoiceLineRows.value[0]?.description,
        subtitle:
            lineCount > 1
                ? $t(
                      {
                          defaultMessage: '{count} items',
                          id: 'upgrade_subscription.order_summary.item_count',
                          description:
                              'Subtitle shown below the product name when multiple one-off items are selected',
                      },
                      { count: String(lineCount) },
                  )
                : invoiceLineRows.value[0]?.description,
    };
});

const invoiceLineRows = computed<
    Array<{ key: string; description: string; amount?: MoneyAmount }>
>(() =>
    (props.invoice?.periods ?? []).flatMap((period, periodIndex) =>
        period.groups.flatMap((group, groupIndex) =>
            (group.lines ?? []).map((line, lineIndex) => ({
                key: `${periodIndex}-${groupIndex}-${lineIndex}`,
                description:
                    line.description ??
                    line.product_items?.[0]?.name ??
                    group.products?.[0]?.name ??
                    group.product_category?.name ??
                    '—',
                amount: line.amount_excluding_tax,
            })),
        ),
    ),
);

const selectedPricingRows = computed(() =>
    props.selectedPricings.map((pricing) => ({
        key: pricing.id,
        description: pricing.name ?? pricing.products?.[0]?.name ?? '—',
        amount: getPrice(pricing),
    })),
);

const title = computed(() =>
    $t({
        defaultMessage: 'Order summary',
        id: 'upgrade_subscription.order_summary.title',
        description: 'Title for the order summary section on the upgrade subscription page',
    }),
);
</script>

<template>
    <Section
        class="sv-order-summary sv-upgrade-subscription__order-summary"
        no-border
        no-spacing
        content-background="none"
        :title="title"
    >
        <div class="sv-order-summary__body grid grid-cols-1 gap-1">
            <Section v-if="isEmpty" no-spacing class="sv-order-summary__empty-state">
                <div class="flex items-center justify-center gap-2 px-3 py-5">
                    <Icon icon="shopping_cart" class="text-gray-500" />
                    <Typography variant="body-sm" weight="semibold" shade="lighter" no-spacing>{{
                        $t({
                            defaultMessage: 'Select your items',
                            id: 'upgrade_subscription.order_summary.empty_state',
                            description:
                                'Placeholder shown when no items are selected in the order summary',
                        })
                    }}</Typography>
                </div>
            </Section>

            <template v-else-if="invoice">
                <Section
                    v-if="invoiceHeader.title"
                    no-spacing
                    class="sv-order-summary__subscription"
                >
                    <div class="flex flex-row gap-3 px-3 py-2">
                        <div class="grow">
                            <Typography variant="body-sm" weight="semibold" no-spacing>{{
                                invoiceHeader.title
                            }}</Typography>
                            <Typography
                                v-if="invoiceHeader.subtitle"
                                variant="body-xs"
                                shade="lighter"
                                no-spacing
                                >{{ invoiceHeader.subtitle }}</Typography
                            >
                        </div>
                    </div>
                </Section>

                <div class="sv-order-summary__items grid grid-cols-1 gap-1">
                    <Section
                        v-for="line in invoiceLineRows"
                        :key="line.key"
                        no-spacing
                        class="sv-order-summary__item"
                    >
                        <div class="flex flex-row gap-2 px-3 py-2">
                            <Typography tag="span" variant="body-xs" class="grow">{{
                                line.description
                            }}</Typography>
                            <Typography
                                v-if="line.amount"
                                tag="span"
                                variant="body-xs"
                                no-spacing
                            >
                                <Amount :value="line.amount" />
                            </Typography>
                        </div>
                    </Section>
                </div>

                <Section class="sv-order-summary__totals">
                    <InvoicePreview
                        class="sv-order-summary__invoice-preview"
                        variant="without-products"
                        :invoice="invoice"
                        is-customer-facing
                    />
                </Section>
            </template>

            <template v-else>
                <Section v-if="loading" no-spacing class="sv-order-summary__subscription">
                    <div class="flex flex-row gap-3 px-3 py-2">
                        <div class="grow">
                            <Typography variant="body-sm" weight="semibold" no-spacing>{{
                                selectedPricingRows.length > 1
                                    ? $t({
                                          defaultMessage: 'Selected items',
                                          id: 'upgrade_subscription.order_summary.selected_items_title',
                                          description:
                                              'Temporary order summary title shown while the invoice preview is loading',
                                      })
                                    : selectedPricingRows[0]?.description
                            }}</Typography>
                            <Typography variant="body-xs" shade="lighter" no-spacing>{{
                                selectedPricingRows.length > 1
                                    ? $t(
                                          {
                                              defaultMessage: '{count} items',
                                              id: 'upgrade_subscription.order_summary.selected_item_count',
                                              description:
                                                  'Temporary order summary subtitle shown while the invoice preview is loading',
                                          },
                                          { count: String(selectedPricingRows.length) },
                                      )
                                    : $t({
                                          defaultMessage: 'one-off',
                                          id: 'upgrade_subscription.order_summary.one_off_label',
                                          description:
                                              'One-off payment label next to a line item in order summary',
                                      })
                            }}</Typography>
                        </div>
                    </div>
                </Section>

                <Section
                    v-for="pricing in selectedPricingRows"
                    :key="pricing.key"
                    no-spacing
                    class="sv-order-summary__item"
                >
                    <div class="flex flex-row gap-2 px-3 py-2">
                        <Typography tag="span" variant="body-xs" class="grow">{{
                            pricing.description
                        }}</Typography>
                        <Typography v-if="pricing.amount" tag="span" variant="body-xs" no-spacing>
                            <Amount :value="pricing.amount" />
                        </Typography>
                    </div>
                </Section>

                <Section v-if="loading" class="sv-order-summary__totals">
                    <div class="grid grid-cols-1 gap-2">
                        <div class="flex items-center justify-between gap-4">
                            <div class="h-4 w-40 animate-pulse rounded bg-gray-100" />
                            <div class="h-4 w-20 animate-pulse rounded bg-gray-100" />
                        </div>
                        <div class="flex items-center justify-between gap-4">
                            <div class="h-4 w-16 animate-pulse rounded bg-gray-100" />
                            <div class="h-4 w-20 animate-pulse rounded bg-gray-100" />
                        </div>
                        <div class="border-t border-gray-200 pt-2">
                            <div class="flex items-center justify-between gap-4">
                                <div class="h-5 w-36 animate-pulse rounded bg-gray-100" />
                                <div class="h-5 w-24 animate-pulse rounded bg-gray-100" />
                            </div>
                        </div>
                    </div>
                </Section>
            </template>
        </div>
    </Section>
</template>
