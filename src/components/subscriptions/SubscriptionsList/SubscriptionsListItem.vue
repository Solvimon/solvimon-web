<script setup lang="ts">
import { computed } from 'vue';
import { PaymentMethod, Section, Typography, useIntl, Button } from '@solvimon/solvimon-ui';
import type {
    SubscriptionsListItemEmits,
    SubscriptionsListItemProps,
} from './SubscriptionsListItem.types';
import { getMostRecentPricingPlan, getSubscriptionName } from '@/utils/subscription';

const props = withDefaults(defineProps<SubscriptionsListItemProps>(), {
    showViewSubscriptionDetailsButton: true,
});
defineEmits<SubscriptionsListItemEmits>();

const { $t } = useIntl();
const { formatDate } = useIntl();

const mostRecentPricingPlan = computed(() => getMostRecentPricingPlan(props.subscription));

const subscriptionName = computed<string>(() =>
    getSubscriptionName({
        subscription: props.subscription,
        fallback: $t({
            defaultMessage: 'Subscription',
            description: 'The fallback name for when no subscription name can be determined',
            id: 'customer_overview.subscriptions_block.fallback_subscription_name',
        }),
    }),
);

const subscriptionDescription = computed<string | undefined>(
    () => mostRecentPricingPlan.value?.description,
);

const isDetailButtonVisible = computed<boolean>(() => props.showViewSubscriptionDetailsButton);
</script>

<template>
    <Section class="sv-subscriptions-list__item">
        <div class="sv-subscriptions-list__item-body flex flex-col gap-4 md:flex-row">
            <div class="sv-subscriptions-list__item-content grow">
                <Typography tag="h3" variant="heading-2" class="sv-subscriptions-list__item-title">
                    {{ subscriptionName }}
                </Typography>
                <Typography
                    v-if="subscriptionDescription"
                    variant="body-sm"
                    tag="span"
                    shade="lighter"
                    class="sv-subscriptions-list__item-description"
                    >{{ subscriptionDescription }}</Typography
                >
                <div class="sv-subscriptions-list__item-meta mt-4 flex items-center gap-6">
                    <PaymentMethod
                        v-if="paymentMethod"
                        variant="condensed"
                        class="sv-payment-methods__item"
                        :payment-method="paymentMethod"
                    />
                    <div
                        v-if="subscription.next_invoice"
                        class="sv-subscriptions-list__item-next-invoice flex gap-1"
                    >
                        <Typography tag="span" variant="body-xs" shade="light" weight="semibold">
                            {{
                                $t({
                                    defaultMessage: 'Next billing date',
                                    description: 'The label for the next billing date',
                                    id: 'customer.subscriptions_block.next_billing_date',
                                })
                            }}
                        </Typography>
                        <Typography tag="span" variant="body-xs" shade="light">{{
                            formatDate({
                                date: subscription.next_invoice.invoice_date,
                                format: 'date',
                                offsetType: 'offsetted',
                                timezone: customer.timezone,
                            })
                        }}</Typography>
                    </div>
                </div>
            </div>
            <div
                class="sv-subscriptions-list__item-actions flex flex-col items-center gap-2 md:flex-row"
            >
                <Button
                    v-if="isDetailButtonVisible"
                    color="primary"
                    class="sv-action sv-action--primary sv-subscriptions-list__item-details w-full md:w-auto"
                    type="button"
                    @click="$emit('view-subscription-details', { subscriptionId: subscription.id })"
                >
                    {{
                        $t({
                            defaultMessage: 'Subscription details',
                            description:
                                'The label for the subscription details button in the subscriptions block',
                            id: 'customer.subscriptions_block.show_details_button_label',
                        })
                    }}
                </Button>
            </div>
        </div>
    </Section>
</template>
