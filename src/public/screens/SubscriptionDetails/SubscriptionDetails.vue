<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { Button, Section, Typography, useIntl, ErrorNotification } from '@solvimon/solvimon-ui';
import type { CustomerWalletBalanceItem } from '@solvimon/solvimon-types';
import type {
    SubscriptionDetailsEmits,
    SubscriptionDetailsProps,
} from './SubscriptionDetails.types';
import { ContentWithAsideLayout } from '@/layouts';
import { useSubscriptionActions } from '@/composables/useSubscriptionActions';
import { getSubscriptionName } from '@/utils/subscription';
import SubscriptionSummary from '@/components/subscriptions/SubscriptionSummary.vue';
import SubscriptionSchedules from '@/public/components/SubscriptionSchedules/SubscriptionSchedules.vue';
import CustomerWalletBalances from '@/public/components/CustomerWalletBalances/CustomerWalletBalances.vue';
import TopUpModal from '@/components/wallets/TopUpModal/TopUpModal.vue';
import { useTopUpModal } from '@/components/wallets/TopUpModal/useTopUpModal';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import EnabledPricingsList from '@/components/subscriptions/EnabledPricingsList/EnabledPricingsList.vue';

const props = withDefaults(defineProps<SubscriptionDetailsProps>(), {
    walletBalances: () => [],
});
defineEmits<SubscriptionDetailsEmits>();

const { $t } = useIntl();

const {
    isCancellable,
    isRenewable,
    cancel: handleCancel,
    renew: handleRenew,
} = useSubscriptionActions({ subscription: toRef(props, 'subscription') });

const selectedBalanceItem = ref<CustomerWalletBalanceItem | undefined>();

const topUpModal = useTopUpModal(selectedBalanceItem);

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
                @top-up="selectedBalanceItem = $event"
            />

            <EnabledPricingsList />

            <TopUpModal
                :show-modal="topUpModal.showModal.value"
                :payment-methods="paymentMethods"
                :customer="customer"
                :selected-balance-item="selectedBalanceItem"
                @close="selectedBalanceItem = undefined"
                @confirm="$emit('top-up-charged')"
                @payment-success="$emit('payment-method-stored')"
            />
        </template>
    </ContentWithAsideLayout>
</template>
