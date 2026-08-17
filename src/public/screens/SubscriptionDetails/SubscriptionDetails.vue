<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import {
    Alert,
    Button,
    Section,
    Typography,
    useIntl,
    ErrorNotification,
} from '@solvimon/solvimon-ui';
import type {
    SubscriptionDetailsEmits,
    SubscriptionDetailsProps,
} from './SubscriptionDetails.types';
import { ContentWithAsideLayout } from '@/layouts';
import { useSubscriptionActions } from '@/composables/useSubscriptionActions';
import { getMostRecentScheduleInfo, getSubscriptionName } from '@/utils/subscription';
import SubscriptionSummary from '@/components/subscriptions/SubscriptionSummary.vue';
import SubscriptionSchedules from '@/public/components/SubscriptionSchedules/SubscriptionSchedules.vue';
import CustomerWalletBalances from '@/public/components/CustomerWalletBalances/CustomerWalletBalances.vue';
import CustomerPaymentMethods from '@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.vue';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import EnabledPricingsList from '@/components/subscriptions/EnabledPricingsList/EnabledPricingsList.vue';
import SubscriptionCancellationModal from '@/components/subscriptions/SubscriptionCancellationModal/SubscriptionCancellationModal.vue';
import type { SubscriptionCancellationVariant } from '@/services/subscriptions';

const props = withDefaults(defineProps<SubscriptionDetailsProps>(), {
    walletBalances: () => [],
});
const emit = defineEmits<SubscriptionDetailsEmits>();

const { $t } = useIntl();

const {
    isCancellable,
    isRenewable,
    pendingVariant,
    cancel: handleCancel,
    renew: handleRenew,
    dismiss: handleDismissCancellation,
    manage: handleUpgrade,
} = useSubscriptionActions({ subscription: toRef(props, 'subscription') });

/**
 * What the customer just did, kept after the modal closes so the screen can confirm it. Cleared when
 * either button is used again, so a second confirmation replaces the first rather than stacking.
 */
const confirmedVariant = ref<SubscriptionCancellationVariant | undefined>();

watch(pendingVariant, (variant) => {
    if (variant) confirmedVariant.value = undefined;
});

/**
 * The change landed, so the subscription on screen is stale — the host refetches it, which is what
 * flips the header between Cancel and Renew.
 */
const handleCancellationConfirmed = () => {
    confirmedVariant.value = pendingVariant.value;
    emit('subscription-changed');
};

const cancellationSuccessMessage = computed<string | undefined>(() => {
    if (!confirmedVariant.value) return undefined;

    return confirmedVariant.value === 'RENEW'
        ? $t({
              defaultMessage: 'Your subscription has been renewed.',
              id: 'subscription_details.renew_success',
              description: 'Confirmation shown after a cancellation has been undone',
          })
        : $t({
              defaultMessage:
                  'Your subscription has been cancelled. You keep access until the end of the billing period.',
              id: 'subscription_details.cancel_success',
              description: 'Confirmation shown after a subscription has been cancelled',
          });
});

/** The upgrades on offer are the ones enabled on the schedule the subscription runs on now. */
const currentScheduleInfo = computed(() => getMostRecentScheduleInfo(props.subscription));

const subscriptionPaymentMethod = computed(() =>
    (props.paymentMethods ?? []).find(({ id }) => id === props.subscription?.payment_method_id),
);

/**
 * The one subscription this screen is about, so a wallet shared with others offers only the
 * top-ups billed on it.
 */
const topUpSubscriptions = computed(() => (props.subscription ? [props.subscription] : []));

/** Falls back to the generic screen title while the subscription is loading or has no name. */
const title = computed<string>(() =>
    getSubscriptionName({
        subscription: props.subscription,
        fallback: $t({
            defaultMessage: 'Subscription details',
            id: 'subscription_details.title',
            description: 'Title for the subscription details page',
        }),
    }),
);
</script>

<template>
    <ContentWithAsideLayout class="sv-subscription-details sv-root sv-screen">
        <template #header>
            <div
                class="sv-subscription-details__header flex flex-col gap-2 md:flex-row md:items-center"
            >
                <Typography variant="heading-2" tag="h1" class="sv-subscription-details__title grow"
                    >{{ title }}
                </Typography>

                <Button
                    v-if="isRenewable"
                    variant="outline"
                    color="gray"
                    class="sv-action sv-action--secondary sv-subscription-details__renew w-full md:w-auto"
                    type="button"
                    @click="handleRenew"
                >
                    {{
                        $t({
                            defaultMessage: 'Renew subscription',
                            id: 'subscription_details.renew_button.label',
                            description:
                                'Label for the renew subscription button on the subscription details page',
                        })
                    }}
                </Button>

                <Button
                    v-if="isCancellable"
                    variant="outline"
                    color="gray"
                    class="sv-action sv-action--secondary sv-subscription-details__cancel w-full md:w-auto"
                    type="button"
                    @click="handleCancel"
                >
                    {{
                        $t({
                            defaultMessage: 'Cancel subscription',
                            id: 'subscription_details.cancel_button.label',
                            description:
                                'Label for the cancel subscription button on the subscription details page',
                        })
                    }}
                </Button>
            </div>
        </template>

        <template #content>
            <Alert
                v-if="cancellationSuccessMessage"
                class="sv-subscription-details__cancellation-success"
                type="success"
                :title="cancellationSuccessMessage"
            />

            <ErrorNotification
                v-if="error"
                class="sv-subscription-details__error sv-error"
                :title="
                    $t({
                        defaultMessage: 'Unable to load this subscription. Please try again later.',
                        id: 'subscription_details.load_error',
                        description:
                            'Error message shown when the subscription cannot be loaded on the subscription details page',
                    })
                "
            />

            <Skeleton v-else-if="isLoading" variant="section" class="min-h-[220px]" />

            <template v-else-if="subscription">
                <Section no-spacing class="sv-subscription-details__summary">
                    <SubscriptionSummary :subscription="subscription" />
                </Section>

                <SubscriptionSchedules
                    class="sv-subscription-details__schedules"
                    :schedules-data="schedulesData ?? []"
                    :configuration="{ subscriptionId: subscription.id }"
                    :is-loading="isLoading"
                />
            </template>

            <EmptyStatePlaceholder
                v-else
                class="sv-subscription-details__empty-state"
                icon="receipt_long"
            >
                <template #title>
                    {{
                        $t({
                            defaultMessage: 'Subscription not found',
                            id: 'subscription_details.empty_state.title',
                            description:
                                'Title shown when the requested subscription does not exist',
                        })
                    }}
                </template>
                <template #message>
                    {{
                        $t({
                            defaultMessage: 'This subscription is no longer available.',
                            id: 'subscription_details.empty_state.message',
                            description:
                                'Message shown when the requested subscription does not exist',
                        })
                    }}
                </template>
            </EmptyStatePlaceholder>
        </template>

        <template #aside>
            <CustomerWalletBalances
                class="sv-subscription-details__wallet-balances"
                :has-error="Boolean(hasWalletBalancesError)"
                :is-loading="isLoading"
                :wallet-balances="walletBalances"
                show-top-up-button
                :customer="customer"
                :payment-methods="paymentMethods"
                :subscriptions="topUpSubscriptions"
                @top-up-charged="$emit('top-up-charged')"
                @payment-method-stored="$emit('payment-method-stored')"
            />

            <EnabledPricingsList
                v-if="currentScheduleInfo"
                class="sv-subscription-details__upgrades"
                :pricing-plan-schedule="currentScheduleInfo"
                @upgrade="handleUpgrade"
            />

            <CustomerPaymentMethods
                v-if="subscriptionPaymentMethod"
                class="sv-subscription-details__payment-method"
                :is-loading="isLoading"
                :payment-methods="[subscriptionPaymentMethod]"
                :configuration="{ showViewAllButton: false, showAddButton: false }"
            />

            <SubscriptionCancellationModal
                :show-modal="Boolean(pendingVariant)"
                :variant="pendingVariant"
                :subscription="subscription"
                :avatar="avatar"
                @confirmed="handleCancellationConfirmed"
                @close="handleDismissCancellation"
            />
        </template>
    </ContentWithAsideLayout>
</template>
