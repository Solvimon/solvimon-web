<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button, ErrorNotification, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { PaymentMethod, Pricing } from '@solvimon/solvimon-types';
import type { SubscriptionManagementProps } from './SubscriptionManagement.types';
import { ContentWithAsideLayout } from '@/layouts';
import { useActionDispatchProvider, useLogger, usePortal } from '@/components/providers';
import { useSubscription } from '@/composables/useSubscription';
import { useCustomer } from '@/composables/useCustomer';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { useSubscriptionUpgradePreview } from '@/composables/useSubscriptionUpgradePreview';
import { createPricingPlanSchedulesService } from '@/services/pricingPlanSchedules';
import SecurePaymentsKPI from '@/components/payments/SecurePaymentsKPI/SecurePaymentsKPI.vue';
import SubscriptionManagementForm from '@/components/subscriptions/SubscriptionManagement/SubscriptionManagementForm.vue';
import SubscriptionManagementSummary from '@/components/subscriptions/SubscriptionManagement/SubscriptionManagementSummary.vue';
import SubscriptionManagementSuccess from '@/components/subscriptions/SubscriptionManagement/SubscriptionManagementSuccess.vue';
import AddPaymentMethodModal from '@/components/payments/AddPaymentMethodModal/AddPaymentMethodModal.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import {
    getActiveDefaultScheduleInfo,
    getPricingGroupByPricingId,
} from '@/utils/pricingPlanSchedule';

const props = defineProps<SubscriptionManagementProps>();

const { $t } = useIntl();
const portal = usePortal();
const logger = useLogger();
const { dispatchAction } = useActionDispatchProvider();
const { createPricingPlanSchedule } = createPricingPlanSchedulesService();

const { subscription, get: fetchSubscription } = useSubscription({
    subscriptionId: props.configuration.subscriptionId,
});

const { items: paymentMethods, fetchAll: fetchPaymentMethods } = usePaymentMethods({
    customerId: portal.value.customer_id,
});

const { customer, get: fetchCustomer } = useCustomer({ customerId: portal.value.customer_id });

const { paymentMethodOptions, get: fetchPaymentMethodOptions } = usePaymentMethodOptions();

const { isLoading } = useLoadInitialData(
    fetchSubscription(),
    fetchPaymentMethods(),
    fetchCustomer.execute(),
    fetchPaymentMethodOptions({ customerId: portal.value.customer_id }),
);

/** Adding a method happens over the screen, so the plan choice behind it is never lost. */
const isAddingPaymentMethod = ref(false);

/** The stored method is not in the list yet, so reload it before returning to the choice. */
const handlePaymentMethodAdded = async () => {
    await fetchPaymentMethods();
    isAddingPaymentMethod.value = false;
};

/** Upgrades are bought on the schedule being billed now, so that is where the group is looked up. */
const activeScheduleInfo = computed(() =>
    getActiveDefaultScheduleInfo(subscription.value?.pricing_plan_schedule_infos ?? []),
);

/**
 * The group the screen changes. The host names the pricing the customer came in on; when it does
 * not, the schedule answers for it — the group its own enabled pricings were chosen from — so
 * opening the screen on a subscription alone still lands on something to change.
 */
const pricingGroup = computed(() => {
    const scheduleInfo = activeScheduleInfo.value;

    if (!scheduleInfo) {
        return undefined;
    }

    const { enabledPricingId } = props.configuration;
    const pricingIds = enabledPricingId
        ? [enabledPricingId]
        : (scheduleInfo.pricing_plan_schedule?.enabled_pricings ?? []).map(
              ({ pricing_id }) => pricing_id,
          );

    return pricingIds
        .map((pricingId) =>
            getPricingGroupByPricingId({ pricingPlanScheduleInfo: scheduleInfo, pricingId }),
        )
        .find((group) => Boolean(group));
});

/**
 * Names the group being changed — "Manage Credit packs". Falls back to the subscription itself
 * while it is still loading, or when the host did not name a pricing to manage.
 */
const title = computed<string>(() =>
    $t(
        {
            defaultMessage: 'Manage {subject}',
            id: 'subscription_management.title',
            description:
                'Title for the manage subscription page, naming the pricing group being changed',
        },
        {
            subject:
                pricingGroup.value?.name ||
                $t({
                    defaultMessage: 'subscription',
                    id: 'subscription_management.title.default_subject',
                    description:
                        'Stands in for the pricing group name in the manage subscription title when no group is known, e.g. "Manage subscription"',
                }),
        },
    ),
);

const enabledPricingIds = ref<Pricing['id'][]>([]);
const paymentMethodId = ref<PaymentMethod['id'] | undefined>();

/**
 * The form starts on what the schedule already has enabled, so the ids of the groups that are not
 * being changed survive being submitted back. Within the group being managed the host's
 * `enabledPricingId` wins, so the screen opens on the pricing the customer came in on even when the
 * schedule has since moved on.
 */
watch(
    [activeScheduleInfo, pricingGroup],
    ([scheduleInfo, group]) => {
        const scheduled = (scheduleInfo?.pricing_plan_schedule?.enabled_pricings ?? []).map(
            ({ pricing_id }) => pricing_id,
        );
        const { enabledPricingId } = props.configuration;
        const groupPricingIds = (group?.pricings ?? []).map(({ id }) => id);

        enabledPricingIds.value =
            enabledPricingId && groupPricingIds.includes(enabledPricingId)
                ? [...scheduled.filter((id) => !groupPricingIds.includes(id)), enabledPricingId]
                : scheduled;
    },
    { immediate: true },
);

const {
    invoice: previewInvoice,
    isPending: isPreviewPending,
    error: previewError,
    load: loadPreview,
} = useSubscriptionUpgradePreview();

/**
 * Re-price on every change of choice, so the summary always answers for what is selected now.
 * Immediate, since the ids are seeded from the schedule before this watcher is registered.
 */
watch(
    [enabledPricingIds, subscription],
    ([pricingIds, loadedSubscription]) => {
        if (!loadedSubscription || pricingIds.length === 0) {
            return;
        }

        void loadPreview({
            subscription: loadedSubscription,
            enabledPricingIds: pricingIds,
        });
    },
    { immediate: true },
);

const isUpdating = ref(false);
const updateError = ref<string | undefined>();

/**
 * The change is committed, so the screen stops offering it and confirms it instead. The customer
 * leaves in their own time, since the change takes a while to show up on the subscription.
 */
const isUpdated = ref(false);

/** The change is paid for, so it cannot be committed until the customer has said with what. */
const canUpdate = computed(
    () =>
        !isLoading.value &&
        !isUpdating.value &&
        enabledPricingIds.value.length > 0 &&
        Boolean(subscription.value) &&
        Boolean(paymentMethodId.value),
);

const handleUpdate = async () => {
    if (!canUpdate.value || !subscription.value) {
        return;
    }

    isUpdating.value = true;
    updateError.value = undefined;

    try {
        await createPricingPlanSchedule({
            pricingPlanSubscriptionId: subscription.value.id,
            enabledPricings: enabledPricingIds.value.map((pricingId) => ({
                pricing_id: pricingId,
            })),
        });

        isUpdated.value = true;
    } catch (error) {
        logger.error(
            'SUBSCRIPTION_UPDATE_FAILED',
            'Failed to start a new pricing plan schedule',
            {},
            error,
        );
        updateError.value = $t({
            defaultMessage: 'Something went wrong. Please try again.',
            id: 'subscription_management.update_error',
            description: 'Error shown when committing a subscription change fails',
        });
    } finally {
        isUpdating.value = false;
    }
};

const billingPeriod = computed(
    () =>
        activeScheduleInfo.value?.pricing_plan_schedule?.billing_period ??
        subscription.value?.billing_period,
);
</script>

<template>
    <ContentWithAsideLayout class="sv-subscription-management sv-root sv-screen">
        <template #header>
            <div class="sv-subscription-management__header">
                <Typography variant="heading-2" tag="h1" class="sv-subscription-management__title">
                    {{ title }}
                </Typography>
            </div>
        </template>

        <template #content>
            <SubscriptionManagementSuccess
                v-if="isUpdated"
                class="sv-subscription-management__success"
                :pricing-group-name="pricingGroup?.name"
            />

            <Skeleton v-else-if="isLoading" variant="section" class="min-h-[220px]" />

            <SubscriptionManagementForm
                v-else-if="pricingGroup && billingPeriod"
                v-model:enabled-pricing-ids="enabledPricingIds"
                v-model:payment-method-id="paymentMethodId"
                class="sv-subscription-management__form"
                :pricing-group="pricingGroup"
                :payment-methods="paymentMethods"
                :payment-method-options="paymentMethodOptions"
                :billing-period="billingPeriod"
                :currency="subscription?.billing_currency"
                @add-payment-method="isAddingPaymentMethod = true"
            />

            <AddPaymentMethodModal
                :show-modal="isAddingPaymentMethod"
                :customer="customer"
                :payment-method-options="paymentMethodOptions"
                @success="handlePaymentMethodAdded"
                @close="isAddingPaymentMethod = false"
            />
        </template>

        <template #aside>
            <!-- The change is paid for by the time it is confirmed, so there is nothing left to do
                 here but leave. -->
            <Button
                v-if="isUpdated"
                size="lg"
                class="sv-action sv-action--primary sv-action--full-width sv-subscription-management__done w-full"
                type="button"
                @click="dispatchAction({ action: 'navigate-to-customer-overview' })"
            >
                {{
                    $t({
                        defaultMessage: 'Done',
                        id: 'subscription_management.done_button.label',
                        description:
                            'Label of the button that leaves the manage subscription screen once the change is committed',
                    })
                }}
            </Button>

            <template v-else>
                <SubscriptionManagementSummary
                    class="sv-subscription-management__summary"
                    :invoice="previewInvoice"
                    :is-pending="isLoading || isPreviewPending"
                    :has-error="Boolean(previewError)"
                />

                <ErrorNotification
                    v-if="updateError"
                    class="sv-subscription-management__update-error sv-error"
                    :title="updateError"
                />

                <div class="flex flex-col gap-2">
                    <Button
                        size="lg"
                        class="sv-action sv-action--primary sv-action--full-width sv-subscription-management__update w-full"
                        type="button"
                        :disabled="!canUpdate"
                        :loading="isUpdating"
                        @click="handleUpdate"
                    >
                        {{
                            $t({
                                defaultMessage: 'Update subscription',
                                id: 'subscription_management.update_button.label',
                                description:
                                    'Label of the button that commits the subscription change',
                            })
                        }}
                    </Button>

                    <SecurePaymentsKPI
                        class="sv-subscription-management__kpi"
                        :payment-method-options="paymentMethodOptions"
                    />
                </div>
            </template>
        </template>
    </ContentWithAsideLayout>
</template>
