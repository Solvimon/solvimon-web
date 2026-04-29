<script setup lang="ts">
import { computed } from 'vue';
import { PaymentMethod, Section, Typography, useIntl, Button } from '@solvimon/solvimon-ui';
import type { PricingPlan } from '@solvimon/solvimon-types';
import type {
    SubscriptionsListItemEmits,
    SubscriptionsListItemProps,
} from './SubscriptionsListItem.types';

const props = withDefaults(defineProps<SubscriptionsListItemProps>(), {
    showViewSubscriptionDetailsButton: true,
    showCancelSubscriptionButton: true,
    showRenewSubscriptionButton: true,
});
defineEmits<SubscriptionsListItemEmits>();

const { $t } = useIntl();
const { formatDate } = useIntl();

const mostRecentPricingPlan = computed<PricingPlan | undefined>(() => {
    const scheduleInfos = props.subscription.pricing_plan_schedule_infos;

    if (scheduleInfos.length === 0) {
        return undefined;
    }

    const latestScheduleInfo = scheduleInfos[scheduleInfos.length - 1];

    return latestScheduleInfo?.pricing_plan_version?.pricing_plan;
});

const subscriptionName = computed<string>(
    () =>
        props.subscription.name ||
        mostRecentPricingPlan.value?.name ||
        $t({
            defaultMessage: 'Subscription',
            description: 'The fallback name for when no subscription name can be determined',
            id: 'customer_overview.subscriptions_block.fallback_subscription_name',
        }),
);

const subscriptionDescription = computed<string | undefined>(
    () => mostRecentPricingPlan.value?.description,
);

const isCancellable = computed<boolean>(() => {
    const inactivePeriods = props.subscription.inactive_periods;
    return !inactivePeriods || inactivePeriods.length === 0;
});

const isRenewable = computed<boolean>(() => {
    const inactivePeriods = props.subscription.inactive_periods;
    return Array.isArray(inactivePeriods) && inactivePeriods.length > 0;
});

const isCancelButtonVisible = computed<boolean>(
    () => isCancellable.value && props.showCancelSubscriptionButton,
);
const isRenewButtonVisible = computed<boolean>(
    () => isRenewable.value && props.showRenewSubscriptionButton,
);
const isDetailButtonVisible = computed<boolean>(() => props.showViewSubscriptionDetailsButton);
</script>

<template>
    <Section>
        <div class="flex flex-col gap-4 md:flex-row">
            <div class="grow">
                <Typography tag="h3" variant="heading-2">
                    {{ subscriptionName }}
                </Typography>
                <Typography
                    v-if="subscriptionDescription"
                    variant="body-sm"
                    tag="span"
                    shade="lighter"
                    >{{ subscriptionDescription }}</Typography
                >
                <div class="mt-4 flex items-center gap-6">
                    <PaymentMethod
                        v-if="paymentMethod"
                        variant="condensed"
                        :payment-method="paymentMethod"
                    />
                    <div v-if="subscription.next_invoice" class="flex gap-1">
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
            <div class="flex flex-col items-center gap-2 md:flex-row">
                <Button
                    v-if="isDetailButtonVisible"
                    color="primary"
                    class="w-full md:w-auto"
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
                <Button
                    v-if="isCancelButtonVisible"
                    variant="outline"
                    color="gray"
                    class="w-full md:w-auto"
                    type="button"
                    @click="$emit('cancel-subscription', { subscriptionId: subscription.id })"
                >
                    {{
                        $t({
                            defaultMessage: 'Cancel subscription',
                            description:
                                'The label for the cancel subscription button in the subscriptions block',
                            id: 'customer.subscriptions_block.cancel_button_label',
                        })
                    }}
                </Button>
                <Button
                    v-else-if="isRenewButtonVisible"
                    variant="outline"
                    color="gray"
                    class="w-full md:w-auto"
                    type="button"
                    @click="$emit('renew-subscription', { subscriptionId: subscription.id })"
                >
                    {{
                        $t({
                            defaultMessage: 'Renew subscription',
                            description:
                                'The label for the renew subscription button in the subscriptions block',
                            id: 'customer.subscriptions_block.renew_button_label',
                        })
                    }}
                </Button>
            </div>
        </div>
    </Section>
</template>
