<script setup lang="ts">
import { computed } from 'vue';
import { PaymentMethod, Section, Typography, useIntl, Button } from '@solvimon/ui';
import type { PricingPlan } from '@solvimon/types';
import type {
    CustomerSubscriptionsBlockItemProps,
    CustomerSubscriptionsBlockItemEmits,
} from './CustomerSubscriptionBlockItem.types';

const props = defineProps<CustomerSubscriptionsBlockItemProps>();
const emit = defineEmits<CustomerSubscriptionsBlockItemEmits>();

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
        })
);

const subscriptionDescription = computed<string | undefined>(
    () => mostRecentPricingPlan.value?.description
);

const isCancellable = computed<boolean>(() => {
    if (props.hideCtaButtons) return false;

    const inactivePeriods = props.subscription.inactive_periods;

    return !inactivePeriods || inactivePeriods.length === 0;
});
const isRenewable = computed<boolean>(() => {
    if (props.hideCtaButtons) return false;

    const inactivePeriods = props.subscription.inactive_periods;

    return Array.isArray(inactivePeriods) && inactivePeriods.length > 0;
});

const handleViewDetails = (): void => {
    emit('view-details', props.subscription.id);
};

const handleCancelSubscription = (): void => {
    emit('cancel-subscription', props.subscription.id);
};

const handleRenewSubscription = (): void => {
    emit('renew-subscription', props.subscription.id);
};
</script>

<template>
    <Section :class="{ 'mt-4': !isFirst }">
        <div class="flex flex-col md:flex-row gap-4">
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
                <div class="flex gap-6 items-center mt-4">
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
            <div class="flex flex-col md:flex-row gap-2 items-center">
                <Button
                    color="primary"
                    class="w-full md:w-auto"
                    type="button"
                    @click="handleViewDetails"
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
                    v-if="isCancellable"
                    variant="outline"
                    color="gray"
                    class="w-full md:w-auto"
                    type="button"
                    @click="handleCancelSubscription"
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
                    v-else-if="isRenewable"
                    variant="outline"
                    color="gray"
                    class="w-full md:w-auto"
                    type="button"
                    @click="handleRenewSubscription"
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

        <!-- <div class="flex flex-col md:flex-row md:items-center">
            <div class="flex flex-col grow">
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
            </div>
            <div class="flex flex-col md:flex-row gap-2 items-center">
                <Button
                    color="primary"
                    class="w-full md:w-auto"
                    :to="{
                        name: 'token-customer-subscriptions-subscriptionId',
                        params: { subscriptionId: subscription.id },
                    }"
                >
                    {{
                        $t({
                            defaultMessage: 'Subscription details',
                            description:
                                'The label for the renew subscription button in the subscriptions block',
                            id: 'customer.subscriptions_block.renew_button_label',
                        })
                    }}
                </Button>
                <Button
                    v-if="isCancellable"
                    variant="outline"
                    color="gray"
                    class="w-full md:w-auto"
                    :to="{
                        name: 'token-customer-subscriptions-subscriptionId-cancel',
                        params: { subscriptionId: subscription.id },
                    }"
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
                    v-else-if="isRenewable"
                    variant="outline"
                    color="gray"
                    class="w-full md:w-auto"
                    :to="{
                        name: 'token-customer-subscriptions-subscriptionId',
                        params: { subscriptionId: subscription.id },
                    }"
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
        </div> -->
    </Section>
</template>
