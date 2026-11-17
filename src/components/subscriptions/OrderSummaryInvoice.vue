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
import OrderSummaryCollapsible from './OrderSummaryCollapsible.vue';
import OrderSummaryQuantity from './OrderSummaryQuantity.vue';
import {
    getGroupsSubtotal,
    getInvoiceGroupName,
    getCompactQuantity,
    getInvoiceGroupQuantity,
} from './OrderSummary.lib';
import { getInvoiceGroupsByRecurrence, getInvoiceGroupsWithDiscounts } from '@/utils/invoice';

/**
 * What an invoice is for and comes to, as the order summary lists it. The `before-totals` slot sits
 * between the products and the totals; the default slot follows the totals.
 */
const props = defineProps<OrderSummaryInvoiceProps>();

const { $t, formatNumber } = useIntl();

const groupsByRecurrence = computed(() => getInvoiceGroupsByRecurrence(props.invoice));
const groupsWithDiscounts = computed(() => getInvoiceGroupsWithDiscounts(props.invoice));

const quantityOf = (group: InvoiceGroup) => {
    const quantity = getInvoiceGroupQuantity(group);
    return quantity === undefined ? undefined : getCompactQuantity(quantity, formatNumber);
};

// Every count of a block takes the widest one's width, so the names after them line up.
const quantityWidthOf = (groups: InvoiceGroup[]): string | undefined => {
    const widest = Math.max(0, ...groups.map((group) => quantityOf(group)?.label.length ?? 0));
    return widest ? `${widest}ch` : undefined;
};

const quantityWidth = computed(() => quantityWidthOf(groupsWithDiscounts.value.flat()));
const sectionRows = computed(() =>
    (props.sections ?? []).map((section) => {
        const clusters = section.invoices.flatMap(getInvoiceGroupsWithDiscounts);
        const names = (section.subscriptions ?? []).flatMap(({ name }) => (name ? [name] : []));
        return {
            ...section,
            clusters,
            subscriptionNames: names.join(', '),
            quantityWidth: quantityWidthOf(clusters.flat()),
        };
    }),
);
// Past three customers the blocks start closed, so the totals stay in view.
const isSectionCollapsed = computed(() => sectionRows.value.length > 3);
const discountsUnderAProduct = computed(
    () =>
        new Set(
            [
                ...groupsWithDiscounts.value,
                ...sectionRows.value.flatMap(({ clusters }) => clusters),
            ].flatMap(([, ...discounts]) => discounts),
        ),
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
        <template v-if="sectionRows.length">
            <component
                :is="isSectionCollapsed ? OrderSummaryCollapsible : Section"
                v-for="section in sectionRows"
                :key="section.key"
                v-bind="
                    isSectionCollapsed
                        ? { title: section.title, subtitle: section.subscriptionNames || undefined }
                        : { noSpacing: true }
                "
                class="sv-order-summary__section"
            >
                <div
                    v-if="!isSectionCollapsed"
                    class="sv-order-summary__section-header flex flex-row items-center gap-2 px-3 py-2"
                >
                    <Typography
                        variant="body-xs"
                        weight="semibold"
                        no-spacing
                        class="sv-order-summary__section-title shrink-0"
                        >{{ section.title }}</Typography
                    >
                    <div
                        v-if="section.subscriptionNames"
                        class="min-w-0"
                        :title="section.subscriptionNames"
                    >
                        <Typography
                            variant="body-xs"
                            no-spacing
                            class="sv-order-summary__section-subscriptions truncate"
                            >{{ section.subscriptionNames }}</Typography
                        >
                    </div>
                </div>
                <Divider v-if="!isSectionCollapsed" spacing="none" />
                <div :class="{ 'px-3 py-2': !isSectionCollapsed }">
                    <template
                        v-for="(cluster, clusterIndex) in section.clusters"
                        :key="clusterIndex"
                    >
                        <div
                            v-for="(group, index) in cluster"
                            :key="index"
                            class="flex flex-row items-center gap-2 py-1.5"
                        >
                            <div class="flex grow flex-row items-center gap-2">
                                <OrderSummaryQuantity
                                    v-if="section.quantityWidth"
                                    :quantity="quantityOf(group)"
                                    :width="section.quantityWidth"
                                />
                                <Typography
                                    v-if="!showsDiscountChip(group)"
                                    tag="span"
                                    variant="body-xs"
                                    weight="semibold"
                                    >{{ getInvoiceGroupName(group) }}</Typography
                                >
                                <InvoicePricingClauseChip
                                    v-else
                                    class="sv-order-summary__discount"
                                    clause-type="DISCOUNT"
                                    :price-details-band="getDiscountBand(group)"
                                />
                            </div>
                            <Typography
                                tag="span"
                                variant="body-xs"
                                weight="medium"
                                color="subtle"
                                class="tabular-nums"
                            >
                                <AmountDisplay :value="group.amount_excluding_tax" />
                            </Typography>
                        </div>
                    </template>
                </div>
            </component>
        </template>
        <template v-else-if="hasBothRecurrences">
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
                            <OrderSummaryQuantity
                                v-if="quantityWidth"
                                :quantity="quantityOf(group)"
                                :width="quantityWidth"
                            />
                            <Typography
                                v-if="!showsDiscountChip(group)"
                                tag="span"
                                variant="body-xs"
                                weight="semibold"
                                >{{ getInvoiceGroupName(group) }}</Typography
                            >
                            <InvoicePricingClauseChip
                                v-else
                                class="sv-order-summary__discount"
                                clause-type="DISCOUNT"
                                :price-details-band="getDiscountBand(group)"
                            />
                        </div>
                        <Typography
                            tag="span"
                            variant="body-xs"
                            weight="medium"
                            color="subtle"
                            class="tabular-nums"
                        >
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
        <Section
            v-if="!sectionRows.length && hasBothRecurrences && groupsByRecurrence.other.length"
        >
            <div
                v-for="(group, index) in groupsByRecurrence.other"
                :key="index"
                class="flex flex-row gap-2 py-1.5"
            >
                <OrderSummaryQuantity
                    v-if="quantityWidth"
                    :quantity="quantityOf(group)"
                    :width="quantityWidth"
                />
                <Typography tag="span" variant="body-xs" weight="semibold" class="grow">{{
                    getInvoiceGroupName(group)
                }}</Typography>
                <Typography
                    tag="span"
                    variant="body-xs"
                    weight="medium"
                    color="subtle"
                    class="tabular-nums"
                >
                    <AmountDisplay :value="group.amount_excluding_tax" />
                </Typography>
            </div>
        </Section>
        <!-- every line in one card, each discount under the product it is on -->
        <Section
            v-if="!sectionRows.length && !hasBothRecurrences && groupsWithDiscounts.length"
            class="sv-order-summary__lines"
        >
            <template v-for="(cluster, clusterIndex) in groupsWithDiscounts" :key="clusterIndex">
                <div
                    v-for="(group, index) in cluster"
                    :key="index"
                    class="flex flex-row items-center gap-2 py-1.5"
                >
                    <div class="flex grow flex-row items-center gap-2">
                        <OrderSummaryQuantity
                            v-if="quantityWidth"
                            :quantity="quantityOf(group)"
                            :width="quantityWidth"
                        />
                        <Typography
                            v-if="!showsDiscountChip(group)"
                            tag="span"
                            variant="body-xs"
                            weight="semibold"
                            >{{ getInvoiceGroupName(group) }}</Typography
                        >
                        <InvoicePricingClauseChip
                            v-else
                            class="sv-order-summary__discount"
                            clause-type="DISCOUNT"
                            :price-details-band="getDiscountBand(group)"
                        />
                    </div>
                    <Typography
                        tag="span"
                        variant="body-xs"
                        weight="medium"
                        color="subtle"
                        class="tabular-nums"
                    >
                        <AmountDisplay :value="group.amount_excluding_tax" />
                    </Typography>
                </div>
            </template>
        </Section>
    </div>

    <slot name="before-totals" />

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
