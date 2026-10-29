<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import {
    Alert,
    Button,
    ErrorNotification,
    Typography,
    getEnabledPricingIds,
    useIntl,
} from '@solvimon/solvimon-ui';
import type {
    PaymentMethod,
    Pricing,
    PricingPlan,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import type { SubscriptionManagementProps } from './SubscriptionManagement.types';
import { ContentWithAsideLayout } from '@/layouts';
import { useActionDispatchProvider, useLogger, usePortal } from '@/components/providers';
import { useSubscription } from '@/composables/useSubscription';
import { useSubscriptionActions } from '@/composables/useSubscriptionActions';
import { useCustomer } from '@/composables/useCustomer';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { useSubscriptionUpgradePreview } from '@/composables/useSubscriptionUpgradePreview';
import { useSubscriptionPlanChangePreview } from '@/composables/useSubscriptionPlanChangePreview';
import {
    useSubscriptionPlanGroup,
    type SubscriptionPlanOption,
} from '@/composables/useSubscriptionPlanGroup';
import { createPricingPlanSchedulesService } from '@/services/pricingPlanSchedules';
import {
    createSubscriptionsService,
    type SubscriptionCancellationVariant,
} from '@/services/subscriptions';
import SecurePaymentsKPI from '@/components/payments/SecurePaymentsKPI/SecurePaymentsKPI.vue';
import SubscriptionManagementForm from '@/components/subscriptions/SubscriptionManagement/SubscriptionManagementForm.vue';
import SubscriptionManagementSummary from '@/components/subscriptions/SubscriptionManagement/SubscriptionManagementSummary.vue';
import SubscriptionManagementSuccess from '@/components/subscriptions/SubscriptionManagement/SubscriptionManagementSuccess.vue';
import SubscriptionPlanChangeSummary from '@/components/subscriptions/SubscriptionManagement/SubscriptionPlanChangeSummary.vue';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import {
    getActiveDefaultScheduleInfo,
    getPricingGroupByPricingId,
} from '@/utils/pricingPlanSchedule';
import { hasCustomizedPricings, withScheduleOverrides } from '@/utils/pricingPlanScheduleOverrides';

const props = defineProps<SubscriptionManagementProps>();

const SubscriptionCancellationModal = defineAsyncComponent(
    () =>
        import('@/components/subscriptions/SubscriptionCancellationModal/SubscriptionCancellationModal.vue'),
);

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
const { changeSubscriptionPlan } = createSubscriptionsService();

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
        pricing_plan_version: withScheduleOverrides(scheduleInfo),
    };
});

const scheduledPricingIds = computed(() =>
    getEnabledPricingIds(activeScheduleInfo.value?.pricing_plan_schedule ?? {}),
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

const title = computed<string>(() =>
    $t({
        defaultMessage: 'Manage subscription',
        id: 'subscription_management.title',
        description: 'Title for the manage subscription page',
    }),
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

/**
 * The plans the subscription may move to (MD-5064): the group its current plan belongs to, which
 * is only there for plans a merchant has grouped.
 */
const {
    options: planOptions,
    currentPricingPlanId,
    load: loadPlanGroup,
} = useSubscriptionPlanGroup();

watch(
    activeScheduleInfo,
    (scheduleInfo) => {
        void loadPlanGroup({
            subscriptionId: props.configuration.subscriptionId,
            scheduleInfo,
        });
    },
    { immediate: true },
);

const pricingPlanId = ref<PricingPlan['id'] | undefined>();

/** The choice opens on the plan being billed today, so staying put is the default. */
watch(
    currentPricingPlanId,
    (planId) => {
        pricingPlanId.value = planId;
    },
    { immediate: true },
);

/** The plan the customer picked, as the group describes it — it carries the timing of the move. */
const selectedPlanOption = computed(() =>
    planOptions.value.find((option) => option.pricingPlanId === pricingPlanId.value),
);

/** A move only happens once the customer picks a plan other than the one they are on. */
const isChangingPlan = computed(() =>
    Boolean(selectedPlanOption.value && !selectedPlanOption.value.isCurrent),
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
    [enabledPricingIds, subscription, activeScheduleInfo, isCustomized, isChangingPlan],
    ([pricingIds, loadedSubscription, scheduleInfo, customized, isPlanChange]) => {
        // Nothing is priced that cannot be committed. A plan change has a preview of its own: it
        // moves the subscription off the very schedule this one is calculated on.
        if (!loadedSubscription || pricingIds.length === 0 || customized || isPlanChange) {
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

const {
    invoice: planChangeInvoice,
    isPending: isPlanChangePreviewPending,
    error: planChangePreviewError,
    load: loadPlanChangePreview,
    reset: resetPlanChangePreview,
} = useSubscriptionPlanChangePreview();

/** Prices the plan picked, and drops that price once the customer is back on their own plan. */
watch(
    [subscription, pricingPlanId, isChangingPlan, isCustomized],
    ([loadedSubscription, planId, isPlanChange, customized]) => {
        if (!loadedSubscription || !planId || !isPlanChange || customized) {
            resetPlanChangePreview();
            return;
        }

        void loadPlanChangePreview({
            subscriptionId: loadedSubscription.id,
            pricingPlanId: planId,
        });
    },
    { immediate: true },
);

/** The price of what is selected now: the move to another plan, or the pricings on this one. */
const summaryInvoice = computed(() =>
    isChangingPlan.value ? planChangeInvoice.value : previewInvoice.value,
);
const isSummaryPending = computed(() =>
    isChangingPlan.value ? isPlanChangePreviewPending.value : isPreviewPending.value,
);
const summaryError = computed(() =>
    isChangingPlan.value ? planChangePreviewError.value : previewError.value,
);

/** One plan is no choice; the screen only offers the move when the group holds more than one. */
const canChangePlan = computed(() => planOptions.value.length > 1);

/**
 * Names the move by the plan's place in the group. Staying on the current plan with nothing changed
 * says so; a change to its pricings is an update.
 */
const submitLabel = computed<string>(() => {
    if (isChangingPlan.value && selectedPlanOption.value?.direction === 'UPGRADE') {
        return $t({
            defaultMessage: 'Upgrade plan',
            id: 'subscription_management.update_button.upgrade_label',
            description:
                'Label of the button that moves the subscription to a higher plan in its group',
        });
    }

    if (isChangingPlan.value && selectedPlanOption.value?.direction === 'DOWNGRADE') {
        return $t({
            defaultMessage: 'Downgrade plan',
            id: 'subscription_management.update_button.downgrade_label',
            description:
                'Label of the button that moves the subscription to a lower plan in its group',
        });
    }

    if (canChangePlan.value && !isChangingPlan.value && !hasChange.value) {
        return $t({
            defaultMessage: 'Your current plan',
            id: 'subscription_management.update_button.current_plan_label',
            description:
                'Label of the disabled button while the customer has their current plan selected and nothing changed',
        });
    }

    return $t({
        defaultMessage: 'Update subscription',
        id: 'subscription_management.update_button.label',
        description: 'Label of the button that commits the subscription change',
    });
});

const isUpdating = ref(false);
const updateError = ref<string | undefined>();

/**
 * The plan the committed change moved to, kept because the selection is what the confirmation
 * names and the options behind it are reloaded once the subscription catches up.
 */
const committedPlanChange = ref<SubscriptionPlanOption | undefined>();

/**
 * The change is committed, so the screen stops offering it and confirms it instead. The customer
 * leaves in their own time, since the change takes a while to show up on the subscription.
 */
const isUpdated = ref(false);

/**
 * Only a change whose price the customer has seen can be committed, and only once there is a
 * payment method to charge it to. A plan change only needs a plan to move to; a change on the
 * current plan needs pricings to enable that differ from what it bills.
 */
const canUpdate = computed(
    () =>
        !isLoading.value &&
        !isUpdating.value &&
        Boolean(subscription.value) &&
        !isCustomized.value &&
        Boolean(paymentMethodId.value) &&
        (isChangingPlan.value ||
            (Boolean(pricingGroup.value) &&
                enabledPricingIds.value.length > 0 &&
                hasChange.value)) &&
        !isSummaryPending.value &&
        !summaryError.value &&
        Boolean(summaryInvoice.value),
);

const handleUpdate = async () => {
    if (!canUpdate.value || !subscription.value) {
        return;
    }

    isUpdating.value = true;
    updateError.value = undefined;

    try {
        if (isChangingPlan.value && pricingPlanId.value) {
            // The group decides when the move lands, so nothing about its timing is sent along.
            await changeSubscriptionPlan({
                id: subscription.value.id,
                pricingPlanId: pricingPlanId.value,
            });

            committedPlanChange.value = selectedPlanOption.value;
        } else {
            await createPricingPlanSchedule({
                pricingPlanSubscriptionId: subscription.value.id,
                enabledPricings: enabledPricingIds.value.map((pricingId) => ({
                    pricing_id: pricingId,
                })),
            });
        }

        isUpdated.value = true;
    } catch (error) {
        if (isChangingPlan.value) {
            logger.error(
                'SUBSCRIPTION_PLAN_CHANGE_FAILED',
                'Failed to move the subscription to another plan in its group',
                {},
                error,
            );
        } else {
            logger.error(
                'SUBSCRIPTION_UPDATE_FAILED',
                'Failed to start a new pricing plan schedule',
                {},
                error,
            );
        }

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

const {
    isCancellable,
    isRenewable,
    pendingVariant,
    cancel,
    renew,
    dismiss: handleDismissCancellation,
} = useSubscriptionActions({ subscription });

/**
 * The confirmation modal, and the customer whose timezone it dates the change in, are loaded the
 * first time the customer asks for it: most visits to this screen are for a change, not to cancel.
 */
const hasRequestedCancellation = ref(false);
const { customer, get: fetchCustomer } = useCustomer({ customerId: portal.value.customer_id });

const requestCancellation = (variant: SubscriptionCancellationVariant) => {
    if (!hasRequestedCancellation.value) {
        hasRequestedCancellation.value = true;
        void fetchCustomer.execute();
    }

    if (variant === 'RENEW') renew();
    else cancel();
};

/** The method the subscription is charged to, which the modal names in its summary. */
const subscriptionPaymentMethod = computed(() =>
    paymentMethods.value.find(({ id }) => id === subscription.value?.payment_method_id),
);

/**
 * What the customer just did, kept after the modal closes so the screen can confirm it. Cleared when
 * either button is used again, so a second confirmation replaces the first rather than stacking.
 */
const confirmedVariant = ref<SubscriptionCancellationVariant | undefined>();

watch(pendingVariant, (variant) => {
    if (variant) confirmedVariant.value = undefined;
});

/** The subscription on screen is stale once it is cancelled or renewed, which is what flips the button. */
const handleCancellationConfirmed = () => {
    confirmedVariant.value = pendingVariant.value;
    void fetchSubscription();
};

const cancellationSuccessMessage = computed<string | undefined>(() => {
    if (!confirmedVariant.value) return undefined;

    return confirmedVariant.value === 'RENEW'
        ? $t({
              defaultMessage: 'Your subscription has been renewed.',
              id: 'subscription_management.renew_success',
              description:
                  'Confirmation shown on the manage subscription screen after a cancellation has been undone',
          })
        : $t({
              defaultMessage:
                  'Your subscription has been cancelled. You keep access until the end of the billing period.',
              id: 'subscription_management.cancel_success',
              description:
                  'Confirmation shown on the manage subscription screen after a subscription has been cancelled',
          });
});

/** What the content column shows, in order of precedence. */
const contentState = computed<
    'updated' | 'loading' | 'load-error' | 'customized' | 'form' | 'empty'
>(() => {
    if (isUpdated.value) return 'updated';
    if (isLoading.value) return 'loading';
    if (subscriptionError.value) return 'load-error';
    if ((pricingGroup.value || canChangePlan.value) && isCustomized.value) return 'customized';
    if ((pricingGroup.value || canChangePlan.value) && billingPeriod.value) return 'form';
    return 'empty';
});

/**
 * Tells a customer looking at the disabled button why it is disabled — only by a message that is
 * on screen.
 */
const submitButtonAttrs = computed(() => {
    const reasonId =
        contentState.value === 'customized'
            ? CUSTOMIZED_PRICING_ID
            : contentState.value === 'form' && subscriptionPaymentMethods.value.length === 0
              ? NO_PAYMENT_METHOD_ID
              : undefined;

    return { form: FORM_ID, ...(reasonId && { 'aria-describedby': reasonId }) };
});
</script>

<template>
    <ContentWithAsideLayout class="sv-subscription-management sv-root sv-screen">
        <template #header>
            <div
                class="sv-subscription-management__header flex flex-col gap-2 md:flex-row md:items-center"
            >
                <Typography
                    variant="heading-2"
                    tag="h1"
                    class="sv-subscription-management__title grow"
                >
                    {{ title }}
                </Typography>

                <template v-if="contentState !== 'updated'">
                    <Button
                        v-if="isRenewable"
                        intent="secondary"
                        class="sv-action sv-action--secondary sv-subscription-management__renew w-full md:w-auto"
                        type="button"
                        @click="requestCancellation('RENEW')"
                    >
                        {{
                            $t({
                                defaultMessage: 'Renew subscription',
                                id: 'subscription_management.renew_button.label',
                                description:
                                    'Label of the button on the manage subscription screen that undoes a pending cancellation',
                            })
                        }}
                    </Button>

                    <Button
                        v-else-if="isCancellable"
                        intent="secondary"
                        class="sv-action sv-action--secondary sv-subscription-management__cancel w-full md:w-auto"
                        type="button"
                        @click="requestCancellation('CANCEL')"
                    >
                        {{
                            $t({
                                defaultMessage: 'Cancel subscription',
                                id: 'subscription_management.cancel_button.label',
                                description:
                                    'Label of the button on the manage subscription screen that cancels the subscription',
                            })
                        }}
                    </Button>
                </template>
            </div>
        </template>

        <template #content>
            <Alert
                v-if="cancellationSuccessMessage"
                class="sv-subscription-management__cancellation-success"
                type="success"
                :title="cancellationSuccessMessage"
            />

            <SubscriptionManagementSuccess
                v-if="contentState === 'updated'"
                class="sv-subscription-management__success"
                :pricing-group-name="committedPlanChange ? undefined : pricingGroup?.name"
                :pricing-plan-name="committedPlanChange?.name"
            />

            <Skeleton
                v-else-if="contentState === 'loading'"
                variant="section"
                class="min-h-[220px]"
            />

            <ErrorNotification
                v-else-if="contentState === 'load-error'"
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
                v-else-if="contentState === 'customized'"
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
                v-else-if="contentState === 'form' && billingPeriod"
                :id="FORM_ID"
                v-model:enabled-pricing-ids="enabledPricingIds"
                v-model:payment-method-id="paymentMethodId"
                v-model:pricing-plan-id="pricingPlanId"
                class="sv-subscription-management__form"
                :pricing-group="pricingGroup"
                :plan-options="planOptions"
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
                <SubscriptionPlanChangeSummary
                    v-if="isChangingPlan && selectedPlanOption"
                    class="sv-subscription-management__plan-change-summary"
                    :plan-name="selectedPlanOption.name"
                    :change-type="selectedPlanOption.changeType"
                />

                <SubscriptionManagementSummary
                    v-if="!isCustomized"
                    class="sv-subscription-management__summary"
                    :invoice="summaryInvoice"
                    :is-pending="isLoading || isSummaryPending"
                    :has-error="Boolean(summaryError)"
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
                        {{ submitLabel }}
                    </Button>

                    <SecurePaymentsKPI
                        class="sv-subscription-management__kpi"
                        :payment-method-options="paymentMethodOptions"
                    />
                </div>
            </template>

            <SubscriptionCancellationModal
                v-if="hasRequestedCancellation"
                :show-modal="Boolean(pendingVariant)"
                :variant="pendingVariant"
                :subscription="subscription"
                :customer="customer"
                :payment-method="subscriptionPaymentMethod"
                @confirmed="handleCancellationConfirmed"
                @close="handleDismissCancellation"
            />
        </template>
    </ContentWithAsideLayout>
</template>
