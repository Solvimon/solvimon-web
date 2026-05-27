<script setup lang="ts">
import { computed } from 'vue';
import { Section, Typography, formatAmount, useIntl } from '@solvimon/solvimon-ui';
import type { Invoice } from '@solvimon/solvimon-types';
import type { OnDemandPricing } from './UpgradeSubscription/UpgradeSubscription.types';

const props = defineProps<{
    selectedPricings: OnDemandPricing[];
    invoice?: Invoice;
    isPending?: boolean;
}>();

const { $t } = useIntl();

const isEmpty = computed(() => props.selectedPricings.length === 0);

const getPrice = (pricing: OnDemandPricing) =>
    pricing.items?.[0]?.configs?.[0]?.bands?.[0]?.fixed_amount;
</script>

<template>
    <Section class="sv-order-summary sv-upgrade-subscription__order-summary">
        <Typography variant="heading-3" tag="h2" class="sv-order-summary__title mb-3">{{
            $t({
                defaultMessage: 'Order summary',
                id: 'upgrade_subscription.order_summary.title',
                description: 'Title for the order summary section on the upgrade subscription page',
            })
        }}</Typography>

        <Typography v-if="isEmpty" variant="body-sm" shade="lighter" class="sv-order-summary__empty">{{
            $t({
                defaultMessage: 'Select add-ons to see pricing.',
                id: 'upgrade_subscription.order_summary.empty_state',
                description: 'Placeholder shown when no add-ons are selected in the order summary',
            })
        }}</Typography>

        <template v-else>
            <!-- Line items -->
            <div class="sv-order-summary__items mb-3 flex flex-col gap-2">
                <div
                    v-for="pricing in selectedPricings"
                    :key="pricing.id"
                    class="sv-order-summary__item flex items-center justify-between"
                >
                    <div>
                        <Typography variant="body-sm" class="sv-order-summary__item-name">{{
                            pricing.name ?? pricing.products?.[0]?.name
                        }}</Typography>
                        <Typography
                            variant="body-xs"
                            shade="lighter"
                            class="sv-order-summary__item-meta"
                        >{{
                            $t({
                                defaultMessage: 'one-off',
                                id: 'upgrade_subscription.order_summary.one_off_label',
                                description:
                                    'One-off payment label next to a line item in order summary',
                            })
                        }}</Typography>
                    </div>
                    <Typography
                        v-if="getPrice(pricing)"
                        variant="body-sm"
                        class="sv-order-summary__item-price"
                    >{{
                        formatAmount(getPrice(pricing)!)
                    }}</Typography>
                </div>
            </div>

            <!-- Tax breakdown (from preview invoice) -->
            <template v-if="invoice?.tax_summary">
                <div class="sv-order-summary__tax flex flex-col gap-1 border-t pt-3">
                    <div class="sv-order-summary__subtotal flex items-center justify-between">
                        <Typography variant="body-sm" shade="lighter">{{
                            $t({
                                defaultMessage: 'Total excluding taxes',
                                id: 'upgrade_subscription.order_summary.subtotal_label',
                                description: 'Subtotal before tax label in order summary',
                            })
                        }}</Typography>
                        <Typography variant="body-sm">{{
                            formatAmount(invoice.tax_summary.base_amount)
                        }}</Typography>
                    </div>
                    <div class="sv-order-summary__tax-row flex items-center justify-between">
                        <Typography variant="body-sm" shade="lighter">{{
                            $t({
                                defaultMessage: 'Taxes',
                                id: 'upgrade_subscription.order_summary.taxes_label',
                                description: 'Tax amount label in order summary',
                            })
                        }}</Typography>
                        <Typography variant="body-sm">{{
                            formatAmount(invoice.tax_summary.tax_amount)
                        }}</Typography>
                    </div>
                </div>
                <div class="sv-order-summary__total flex items-center justify-between border-t pt-3">
                    <Typography variant="body-sm" weight="semibold">{{
                        $t({
                            defaultMessage: 'Total due today',
                            id: 'upgrade_subscription.order_summary.total_label',
                            description: 'Total amount due today label in order summary',
                        })
                    }}</Typography>
                    <Typography variant="body-sm" weight="semibold">{{
                        formatAmount(invoice.tax_summary.total_amount)
                    }}</Typography>
                </div>
            </template>
        </template>
    </Section>
</template>
