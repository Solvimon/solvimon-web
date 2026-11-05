<script setup lang="ts">
import {
    Amount as AmountDisplay,
    Divider,
    InvoicePreview,
    InvoicePricingClauseChip,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import type { Amount, InvoiceGroup } from '@solvimon/solvimon-types';
import { computed } from 'vue';
import type { OrderSummaryInvoiceProps } from './OrderSummaryInvoice.types';
import { getGroupsSubtotal, getInvoiceGroupName } from './OrderSummary.lib';
import { getInvoiceGroupsByRecurrence, getInvoiceGroupsWithDiscounts } from '@/utils/invoice';

/** What an invoice is for and comes to, as the order summary lists it; the default slot follows the totals. */
const props = defineProps<OrderSummaryInvoiceProps>();

const { $t } = useIntl();

const groupsByRecurrence = computed(() => getInvoiceGroupsByRecurrence(props.invoice));
const groupsWithDiscounts = computed(() => getInvoiceGroupsWithDiscounts(props.invoice));
const discountsUnderAProduct = computed(
    () => new Set(groupsWithDiscounts.value.flatMap(([, ...discounts]) => discounts)),
);

const getDiscountBand = (group: InvoiceGroup) =>
    group.lines?.find(({ type }) => type === 'DISCOUNT')?.details?.band;

// ui's chip draws nothing without a percentage or amount, so such a discount keeps its name.
const showsDiscountChip = (group: InvoiceGroup): boolean => {
    const band = getDiscountBand(group);
    return discountsUnderAProduct.value.has(group) && !!(band?.percentage || band?.amount);
};

// An invoice of one kind reads as it always has: a heading over every row explains nothing.
const hasBothRecurrences = computed(
    () =>
        groupsByRecurrence.value.recurring.length > 0 && groupsByRecurrence.value.oneOff.length > 0,
);

// A subtotal of a single row is the row again.
const subtotalOf = (groups: InvoiceGroup[]): Amount | undefined =>
    groups.length > 1 ? getGroupsSubtotal(groups, props.invoice.billing_currency) : undefined;
</script>

<template>
    <!-- invoice groups preview -->
    <div
        v-if="variant !== 'products-inline'"
        :class="[
            'transition duration-200 ease-out motion-reduce:transition-none',
            { blur: isUpdating },
        ]"
        :aria-busy="isUpdating"
        class="sv-order-summary__items grid grid-cols-1 gap-1"
    >
        <template v-if="hasBothRecurrences">
            <div
                v-for="section in [
                    {
                        key: 'recurring',
                        groups: groupsByRecurrence.recurring,
                        heading: $t({
                            defaultMessage: 'Subscription',
                            id: 'checkout.order_summary_block.recurring_heading',
                            description:
                                'The heading above the charges that are made every billing period',
                        }),
                    },
                    {
                        key: 'one-off',
                        groups: groupsByRecurrence.oneOff,
                        heading: $t({
                            defaultMessage: 'One-time charges',
                            id: 'checkout.order_summary_block.one_off_heading',
                            description:
                                'The heading above the charges that are made once and not again',
                        }),
                    },
                ]"
                :key="section.key"
                :class="`sv-order-summary__items-${section.key}`"
            >
                <Typography variant="caps-heading">{{ section.heading }}</Typography>
                <Section>
                    <div
                        v-for="(group, index) in section.groups"
                        :key="index"
                        class="flex flex-row items-center gap-2 py-1.5"
                    >
                        <div class="flex grow flex-row items-center gap-2">
                            <Typography
                                v-if="!showsDiscountChip(group)"
                                tag="span"
                                variant="body-xs"
                                >{{ getInvoiceGroupName(group) }}</Typography
                            >
                            <InvoicePricingClauseChip
                                v-else
                                class="sv-order-summary__discount"
                                clause-type="DISCOUNT"
                                :price-details-band="getDiscountBand(group)"
                            />
                        </div>
                        <Typography tag="span" variant="body-xs">
                            <AmountDisplay :value="group.amount_excluding_tax" />
                        </Typography>
                    </div>
                    <template v-if="subtotalOf(section.groups)">
                        <Divider spacing="xxs" />
                        <div class="flex flex-row gap-2 py-1.5">
                            <Typography
                                tag="span"
                                variant="body-xs"
                                weight="semibold"
                                class="grow"
                                >{{
                                    $t({
                                        defaultMessage: 'Subtotal',
                                        id: 'checkout.order_summary_block.subtotal',
                                        description:
                                            'The label of a section total in the order summary',
                                    })
                                }}</Typography
                            >
                            <Typography tag="span" variant="body-xs" weight="semibold">
                                <AmountDisplay :value="subtotalOf(section.groups)!" />
                            </Typography>
                        </div>
                    </template>
                </Section>
            </div>
        </template>
        <Section v-if="hasBothRecurrences && groupsByRecurrence.other.length">
            <div
                v-for="(group, index) in groupsByRecurrence.other"
                :key="index"
                class="flex flex-row gap-2 py-1.5"
            >
                <Typography tag="span" variant="body-xs" class="grow">{{
                    getInvoiceGroupName(group)
                }}</Typography>
                <Typography tag="span" variant="body-xs">
                    <AmountDisplay :value="group.amount_excluding_tax" />
                </Typography>
            </div>
        </Section>
        <template v-if="!hasBothRecurrences">
            <Section v-for="(cluster, clusterIndex) in groupsWithDiscounts" :key="clusterIndex">
                <div class="grid grid-cols-1 gap-1">
                    <div
                        v-for="(group, index) in cluster"
                        :key="index"
                        class="flex flex-row items-center gap-2"
                    >
                        <div class="flex grow flex-row items-center gap-2">
                            <Typography
                                v-if="!showsDiscountChip(group)"
                                tag="span"
                                variant="body-xs"
                                >{{ getInvoiceGroupName(group) }}</Typography
                            >
                            <InvoicePricingClauseChip
                                v-else
                                class="sv-order-summary__discount"
                                clause-type="DISCOUNT"
                                :price-details-band="getDiscountBand(group)"
                            />
                        </div>
                        <Typography tag="span" variant="body-xs">
                            <AmountDisplay :value="group.amount_excluding_tax" />
                        </Typography>
                    </div>
                </div>
            </Section>
        </template>
    </div>

    <!-- invoice totals preview -->
    <Section
        :class="[
            'transition duration-200 ease-out motion-reduce:transition-none',
            { blur: isUpdating },
        ]"
        v-bind="{ 'aria-busy': isUpdating }"
        class="sv-order-summary__totals"
    >
        <InvoicePreview
            class="sv-order-summary__invoice-preview"
            :variant="variant === 'products-inline' ? 'default' : 'without-products'"
            :invoice="invoice"
            :trial-invoice="trialInvoice"
            :is-paid="isPaid"
            :collapsible="collapsible"
            :is-preview-without-taxes="isPreviewWithoutTaxes"
            is-customer-facing
        />
        <slot />
    </Section>
</template>
