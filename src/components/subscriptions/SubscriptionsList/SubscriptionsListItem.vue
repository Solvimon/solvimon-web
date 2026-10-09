<script setup lang="ts">
import { computed, defineAsyncComponent, ref, toRef } from 'vue';
import { PaymentMethod, Section, Typography, useIntl, Button } from '@solvimon/solvimon-ui';
import type {
    SubscriptionsListItemEmits,
    SubscriptionsListItemProps,
} from './SubscriptionsListItem.types';
import { getMostRecentPricingPlan, getSubscriptionName } from '@/utils/subscription';
import { useSubscriptionActions } from '@/composables/useSubscriptionActions';

const SubscriptionCancellationModal = defineAsyncComponent(
    () =>
        import('@/components/subscriptions/SubscriptionCancellationModal/SubscriptionCancellationModal.vue'),
);

const props = withDefaults(defineProps<SubscriptionsListItemProps>(), {
    showViewSubscriptionDetailsButton: false,
    showUpgradeButton: true,
    showCancelButton: true,
});
const emit = defineEmits<SubscriptionsListItemEmits>();

const { $t } = useIntl();
const { formatDate } = useIntl();

const {
    isCancellable,
    isRenewable,
    pendingVariant,
    cancel,
    renew,
    dismiss: handleDismissCancellation,
    manage: handleUpgrade,
} = useSubscriptionActions({ subscription: toRef(props, 'subscription') });

/**
 * The confirmation modal is loaded on demand: most customers never open it, and it is the heaviest
 * thing this card could pull onto the overview. It stays mounted afterwards so closing it animates.
 */
const hasRequestedCancellation = ref(false);

const handleCancel = () => {
    hasRequestedCancellation.value = true;
    cancel();
};

const handleRenew = () => {
    hasRequestedCancellation.value = true;
    renew();
};

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

const isUpgradeButtonVisible = computed<boolean>(() => props.showUpgradeButton);

const isCancelButtonVisible = computed<boolean>(
    () => props.showCancelButton && isCancellable.value,
);

const isRenewButtonVisible = computed<boolean>(() => props.showCancelButton && isRenewable.value);

/** A card has one primary action, and it is the upgrade wherever that is on offer. */
const detailButtonIntent = computed(() => (isUpgradeButtonVisible.value ? 'subtle' : 'primary'));

/** The subscription on screen is stale once it has been cancelled or renewed, so the list reloads. */
const handleCancellationConfirmed = () => {
    emit('subscription-changed');
};
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
                    color="subtle"
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
                        <Typography
                            tag="span"
                            variant="body-xs"
                            color="secondary"
                            weight="semibold"
                        >
                            {{
                                $t({
                                    defaultMessage: 'Next billing date',
                                    description: 'The label for the next billing date',
                                    id: 'customer.subscriptions_block.next_billing_date',
                                })
                            }}
                        </Typography>
                        <Typography tag="span" variant="body-xs" color="secondary">{{
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
                class="sv-subscriptions-list__item-actions flex flex-col items-center gap-2 md:flex-row md:items-start"
            >
                <Button
                    v-if="isUpgradeButtonVisible"
                    intent="primary"
                    size="sm"
                    class="sv-action sv-action--primary sv-subscriptions-list__item-upgrade w-full md:w-auto"
                    type="button"
                    @click="handleUpgrade"
                >
                    {{
                        $t({
                            defaultMessage: 'Upgrade',
                            description:
                                'The label for the upgrade button on a subscription in the subscriptions block',
                            id: 'customer.subscriptions_block.upgrade_button_label',
                        })
                    }}
                </Button>

                <Button
                    v-if="isRenewButtonVisible"
                    intent="secondary"
                    size="sm"
                    class="sv-action sv-action--secondary sv-subscriptions-list__item-renew w-full md:w-auto"
                    type="button"
                    @click="handleRenew"
                >
                    {{
                        $t({
                            defaultMessage: 'Renew',
                            description:
                                'The label for the renew button on a cancelled subscription in the subscriptions block',
                            id: 'customer.subscriptions_block.renew_button_label',
                        })
                    }}
                </Button>

                <Button
                    v-else-if="isCancelButtonVisible"
                    intent="secondary"
                    size="sm"
                    class="sv-action sv-action--secondary sv-subscriptions-list__item-cancel w-full md:w-auto"
                    type="button"
                    @click="handleCancel"
                >
                    {{
                        $t({
                            defaultMessage: 'Cancel',
                            description:
                                'The label for the cancel button on a subscription in the subscriptions block',
                            id: 'customer.subscriptions_block.cancel_button_label',
                        })
                    }}
                </Button>

                <Button
                    v-if="isDetailButtonVisible"
                    :intent="detailButtonIntent"
                    size="sm"
                    class="sv-action sv-subscriptions-list__item-details w-full md:w-auto"
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

        <SubscriptionCancellationModal
            v-if="hasRequestedCancellation"
            :show-modal="Boolean(pendingVariant)"
            :variant="pendingVariant"
            :subscription="subscription"
            @confirmed="handleCancellationConfirmed"
            @close="handleDismissCancellation"
        />
    </Section>
</template>
