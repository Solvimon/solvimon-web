<script setup lang="ts">
import { computed, toRef } from 'vue';
import { Button, Section, Typography, useIntl, ErrorNotification } from '@solvimon/solvimon-ui';
import type { SubscriptionDetailsProps } from './SubscriptionDetails.types';
import { ContentWithAsideLayout } from '@/layouts';
import { useSubscriptionActions } from '@/composables/useSubscriptionActions';
import SubscriptionSummary from '@/components/subscriptions/SubscriptionSummary.vue';
import SubscriptionSchedules from '@/public/components/SubscriptionSchedules/SubscriptionSchedules.vue';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import Skeleton from '@/components/shared/Skeleton.vue';

const props = defineProps<SubscriptionDetailsProps>();

const { $t } = useIntl();

const {
    isCancellable,
    isRenewable,
    cancel: handleCancel,
    renew: handleRenew,
} = useSubscriptionActions({ subscription: toRef(props, 'subscription') });

const mostRecentPricingPlan = computed(
    () => props.subscription?.pricing_plan_schedule_infos?.at(-1)?.pricing_plan_version.pricing_plan,
);

/** Falls back to the generic screen title while the subscription is loading or has no name. */
const title = computed<string>(
    () =>
        props.subscription?.name ||
        mostRecentPricingPlan.value?.name ||
        $t({
            defaultMessage: 'Subscription details',
            id: 'subscription_details.title',
            description: 'Title for the subscription details page',
        }),
);
</script>

<template>
    <ContentWithAsideLayout class="sv-subscription-details sv-root sv-screen">
        <template #header>
            <div
                class="sv-subscription-details__header flex flex-col gap-2 md:flex-row md:items-center"
            >
                <Typography
                    variant="heading-2"
                    tag="h1"
                    class="sv-subscription-details__title grow"
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
            <!-- Scaffolding only. Actions on the subscription belong here. -->
        </template>
    </ContentWithAsideLayout>
</template>
