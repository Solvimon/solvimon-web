<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button, ErrorNotification, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { PaymentMethod, Pricing } from '@solvimon/solvimon-types';
import type { SubscriptionManagementProps } from './SubscriptionManagement.types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { ContentWithAsideLayout } from '@/layouts';
import { useActionDispatchProvider, useLogger, usePortal } from '@/components/providers';
import { useSubscription } from '@/composables/useSubscription';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { useSubscriptionUpgradePreview } from '@/composables/useSubscriptionUpgradePreview';
import { createPricingPlanSchedulesService } from '@/services/pricingPlanSchedules';
import SecurePaymentsKPI from '@/components/payments/SecurePaymentsKPI/SecurePaymentsKPI.vue';
import SubscriptionManagementForm from '@/components/subscriptions/SubscriptionManagement/SubscriptionManagementForm.vue';
import SubscriptionManagementSummary from '@/components/subscriptions/SubscriptionManagement/SubscriptionManagementSummary.vue';
import SubscriptionManagementSuccess from '@/components/subscriptions/SubscriptionManagement/SubscriptionManagementSuccess.vue';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import {
    getActiveDefaultScheduleInfo,
    getPricingGroupByPricingId,
} from '@/utils/pricingPlanSchedule';
import {
    combinePricingPlanVersionWithOverrides,
    getEnabledPricingIdsWithOverrides,
    hasCustomizedPricings,
} from '@/utils/pricingPlanScheduleOverrides';

const props = defineProps<SubscriptionManagementProps>();

/**
 * The submit button sits in the aside, outside the form, so it names the form — which is also what
 * lets Enter in the form commit. Bound as a plain attribute, since `Button` does not declare it.
 */
const FORM_ID = 'sv-subscription-management-form';
const NO_PAYMENT_METHOD_ID = `${FORM_ID}__no-payment-method`;
const CUSTOMIZED_PRICING_ID = 'sv-subscription-management__customized-pricing-message';

/** The payment method types `validatePaymentMethod` lets a portal change be charged to. */
const CHARGEABLE_PAYMENT_METHOD_TYPES: string[] = [
    'BUY_NOW_PAY_LATER',
    'CARD',
    'DIGITAL_WALLET',
    'DIRECT_DEBIT',
    'ONLINE_BANKING',
];

const isChargeable = (
    paymentMethod: PaymentMethod,
    subscription: PricingPlanSubscriptionExpanded | undefined,
): boolean =>
    Boolean(subscription) &&
    paymentMethod.id === subscription?.payment_method_id &&
    paymentMethod.status === 'ACTIVE' &&
    paymentMethod.customer_id === subscription?.customer_id &&
    CHARGEABLE_PAYMENT_METHOD_TYPES.includes(paymentMethod.type);

const { $t } = useIntl();
const portal = usePortal();
const logger = useLogger();
const { dispatchAction } = useActionDispatchProvider();
const { createPricingPlanSchedule } = createPricingPlanSchedulesService();

const {
    subscription,
    get: fetchSubscription,
    error: subscriptionError,
} = useSubscription({
    subscriptionId: props.configuration.subscriptionId,
});

const { items: paymentMethods, fetchAll: fetchPaymentMethods } = usePaymentMethods({
    customerId: portal.value.customer_id,
});

const { paymentMethodOptions, get: fetchPaymentMethodOptions } = usePaymentMethodOptions();

const { isLoading } = useLoadInitialData(
    fetchSubscription(),
    fetchPaymentMethods(),
    fetchPaymentMethodOptions({ customerId: portal.value.customer_id }),
);

/**
 * The API charges the change to the subscription's own payment method and takes no other, and only
 * while that method is one it can charge — so that is all there is on offer.
 */
const subscriptionPaymentMethods = computed(() =>
    paymentMethods.value.filter((paymentMethod) => isChargeable(paymentMethod, subscription.value)),
);

/** Upgrades are bought on the schedule being billed now, so that is where the group is looked up. */
const activeScheduleInfo = computed(() =>
    getActiveDefaultScheduleInfo(subscription.value?.pricing_plan_schedule_infos ?? []),
);

/** With its customized pricings in place, under the ids the schedule bills them by. */
const billedScheduleInfo = computed(() => {
    const scheduleInfo = activeScheduleInfo.value;

    if (!scheduleInfo?.pricing_plan_version) {
        return scheduleInfo;
    }

    return {
        ...scheduleInfo,
        pricing_plan_version: combinePricingPlanVersionWithOverrides({
            pricingPlanVersion: scheduleInfo.pricing_plan_version,
            overridePricings: scheduleInfo.pricing_plan_schedule?.override_pricings,
        }),
    };
});

const scheduledPricingIds = computed(() =>
    getEnabledPricingIdsWithOverrides(activeScheduleInfo.value?.pricing_plan_schedule),
);

/**
 * A new schedule starts from enabled pricings alone and the API copies no customized pricing onto
 * it, nor takes the original of one as enabled. Any change would drop the customization, so a
 * subscription that has one is not changed here at all.
 */
const isCustomized = computed(() =>
    hasCustomizedPricings(activeScheduleInfo.value?.pricing_plan_schedule),
);

/**
 * The group the screen changes. The host names the pricing the customer came in on; when it does
 * not, the schedule answers for it — the group its own enabled pricings were chosen from — so
 * opening the screen on a subscription alone still lands on something to change.
 */
const pricingGroup = computed(() => {
    const scheduleInfo = billedScheduleInfo.value;

    if (!scheduleInfo) {
        return undefined;
    }

    const { enabledPricingId } = props.configuration;
    const pricingIds = enabledPricingId ? [enabledPricingId] : scheduledPricingIds.value;

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
    [scheduledPricingIds, pricingGroup],
    ([scheduled, group]) => {
        const { enabledPricingId } = props.configuration;
        const groupPricingIds = (group?.pricings ?? []).map(({ id }) => id);

        enabledPricingIds.value =
            enabledPricingId && groupPricingIds.includes(enabledPricingId)
                ? [...scheduled.filter((id) => !groupPricingIds.includes(id)), enabledPricingId]
                : scheduled;
    },
    { immediate: true },
);

/** Committing what the schedule already bills would only start a duplicate of it. */
const hasChange = computed(() => {
    const selected = new Set(enabledPricingIds.value);
    const scheduled = new Set(scheduledPricingIds.value);

    return selected.size !== scheduled.size || [...selected].some((id) => !scheduled.has(id));
});

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
    [enabledPricingIds, subscription, activeScheduleInfo, isCustomized],
    ([pricingIds, loadedSubscription, scheduleInfo, customized]) => {
        // Nothing is priced that cannot be committed.
        if (!loadedSubscription || pricingIds.length === 0 || customized) {
            return;
        }

        void loadPreview({
            subscription: loadedSubscription,
            scheduleInfo,
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

/**
 * Only a change whose price the customer has seen can be committed, and only once there is a
 * payment method to charge it to.
 */
const canUpdate = computed(
    () =>
        !isLoading.value &&
        !isUpdating.value &&
        Boolean(subscription.value) &&
        Boolean(pricingGroup.value) &&
        !isCustomized.value &&
        enabledPricingIds.value.length > 0 &&
        hasChange.value &&
        Boolean(paymentMethodId.value) &&
        !isPreviewPending.value &&
        !previewError.value &&
        Boolean(previewInvoice.value),
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

/** Tells a customer looking at the disabled button why it is disabled. */
const submitButtonAttrs = computed(() => {
    const reasonId = isCustomized.value
        ? CUSTOMIZED_PRICING_ID
        : pricingGroup.value && subscriptionPaymentMethods.value.length === 0
          ? NO_PAYMENT_METHOD_ID
          : undefined;

    return { form: FORM_ID, ...(reasonId && { 'aria-describedby': reasonId }) };
});

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

            <ErrorNotification
                v-else-if="subscriptionError"
                class="sv-subscription-management__load-error sv-error"
                :title="
                    $t({
                        defaultMessage: 'Unable to load this subscription. Please try again later.',
                        id: 'subscription_management.load_error',
                        description:
                            'Error shown in place of the manage subscription form when the subscription cannot be loaded',
                    })
                "
            />

            <EmptyStatePlaceholder
                v-else-if="pricingGroup && isCustomized"
                class="sv-subscription-management__customized-pricing"
                icon="info"
            >
                <template #title>
                    {{
                        $t({
                            defaultMessage: 'This subscription has custom pricing',
                            id: 'subscription_management.customized_pricing.title',
                            description:
                                'Title shown on the manage subscription screen in place of the form when the subscription has pricing customized for it, which cannot be changed here',
                        })
                    }}
                </template>
                <template #message>
                    <span :id="CUSTOMIZED_PRICING_ID">{{
                        $t({
                            defaultMessage: 'Please contact support to change it.',
                            id: 'subscription_management.customized_pricing.message',
                            description:
                                'Message shown on the manage subscription screen when the subscription has pricing customized for it, which cannot be changed here',
                        })
                    }}</span>
                </template>
            </EmptyStatePlaceholder>

            <SubscriptionManagementForm
                v-else-if="pricingGroup && billingPeriod"
                :id="FORM_ID"
                v-model:enabled-pricing-ids="enabledPricingIds"
                v-model:payment-method-id="paymentMethodId"
                class="sv-subscription-management__form"
                :pricing-group="pricingGroup"
                :payment-methods="subscriptionPaymentMethods"
                :billing-period="billingPeriod"
                :currency="subscription?.billing_currency"
                :disabled="isUpdating"
                @submit="handleUpdate"
            />

            <EmptyStatePlaceholder
                v-else
                class="sv-subscription-management__empty-state"
                icon="receipt_long"
            >
                <template #title>
                    {{
                        $t({
                            defaultMessage: 'Nothing to change',
                            id: 'subscription_management.empty_state.title',
                            description:
                                'Title shown on the manage subscription screen when the subscription has nothing the customer can change',
                        })
                    }}
                </template>
                <template #message>
                    {{
                        $t({
                            defaultMessage:
                                'This subscription has no options that can be changed right now.',
                            id: 'subscription_management.empty_state.message',
                            description:
                                'Message shown on the manage subscription screen when the subscription is not running or has no group of options to choose from',
                        })
                    }}
                </template>
            </EmptyStatePlaceholder>
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
                    v-if="!isCustomized"
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
                        type="submit"
                        v-bind="submitButtonAttrs"
                        :disabled="!canUpdate"
                        :loading="isUpdating"
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
