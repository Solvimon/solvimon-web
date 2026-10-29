<script setup lang="ts">
import {
    ErrorNotification,
    Modal,
    PaymentMethod,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed, ref, watch } from 'vue';
import type { Pricing } from '@solvimon/solvimon-types';
import type {
    SubscriptionCancellationModalEmits,
    SubscriptionCancellationModalProps,
} from './SubscriptionCancellationModal.types';
import { useSubscriptionCancellationModalLabels } from './useSubscriptionCancellationModalLabels';
import {
    createSubscriptionsService,
    type SubscriptionCancellationVariant,
} from '@/services/subscriptions';
import SubscriptionSummary from '@/components/subscriptions/SubscriptionSummary.vue';
import { getActiveDefaultScheduleInfo } from '@/utils/pricingPlanSchedule';
import { getUndoableCancellation } from '@/utils/subscription';
import { useLogger } from '@/components/providers';

const props = defineProps<SubscriptionCancellationModalProps>();
const emit = defineEmits<SubscriptionCancellationModalEmits>();

const { $t, formatDate } = useIntl();
const logger = useLogger();

const { setSubscriptionCancellation } = createSubscriptionsService();

/** Holds the last variant while the modal closes, so its copy does not flip mid-animation. */
const variant = ref<SubscriptionCancellationVariant | undefined>(props.variant);

watch(
    () => props.variant,
    (next) => {
        if (next) variant.value = next;
    },
);

/** In the customer's own timezone, as the rest of the portal dates their subscription. */
const formatCustomerDate = (date: string): string => {
    const timezone = props.customer?.timezone;

    return timezone
        ? formatDate({ date, format: 'date', offsetType: 'offsetted', timezone })
        : formatDate({ date, format: 'date', offsetType: 'local' });
};

const renewableUntil = computed(() => {
    const cancellation = getUndoableCancellation(props.subscription);

    return cancellation ? formatCustomerDate(cancellation.start_at) : undefined;
});

const billingPeriodEndsAt = computed(() => {
    const invoiceDate = props.subscription?.next_invoice?.invoice_date;

    return invoiceDate ? formatCustomerDate(invoiceDate) : undefined;
});

const renewsOn = billingPeriodEndsAt;

/** What is being cancelled is what is billed now, not a change that has yet to start. */
const enabledPricingIds = computed(() =>
    (
        getActiveDefaultScheduleInfo(props.subscription?.pricing_plan_schedule_infos ?? [])
            ?.pricing_plan_schedule?.enabled_pricings ?? []
    )
        .map(({ pricing_id }) => pricing_id)
        .filter((pricingId): pricingId is Pricing['id'] => Boolean(pricingId)),
);

const { title, explanation, confirmButtonText, cancelButtonText, errorMessage } =
    useSubscriptionCancellationModalLabels({ variant, renewableUntil, billingPeriodEndsAt });

const isSubmitting = ref(false);
const hasFailed = ref(false);

watch(
    () => props.showModal,
    (showModal) => {
        if (!showModal) return;

        hasFailed.value = false;
    },
);

const handleConfirm = async () => {
    if (!props.subscription || !props.variant || isSubmitting.value) {
        return;
    }

    isSubmitting.value = true;
    hasFailed.value = false;

    try {
        await setSubscriptionCancellation({
            id: props.subscription.id,
            variant: props.variant,
        });

        emit('confirmed');
        emit('close');
    } catch (error) {
        logger.error(
            'SUBSCRIPTION_CANCELLATION_FAILED',
            'Failed to change the cancellation state of a subscription',
            { variant: props.variant },
            error,
        );
        hasFailed.value = true;
    } finally {
        isSubmitting.value = false;
    }
};

const handleClose = () => {
    if (isSubmitting.value) return;

    emit('close');
};

/** Whether it is the customer's default has no bearing on cancelling, so the summary leaves it out. */
const summaryPaymentMethod = computed(() =>
    props.paymentMethod ? { ...props.paymentMethod, is_default: false } : undefined,
);
</script>

<template>
    <Modal
        size="md"
        :show-modal="showModal"
        :title="title"
        :confirm-button-text="confirmButtonText"
        :cancel-button-text="cancelButtonText"
        :is-loading="isSubmitting"
        :no-click-away="isSubmitting"
        :no-backdrop-close="isSubmitting"
        @confirm="handleConfirm"
        @close="handleClose"
    >
        <template #body>
            <div
                class="sv-subscription-cancellation-modal sv-subscription-cancellation-modal__body flex flex-col gap-3"
            >
                <Typography
                    variant="body-sm"
                    color="subtle"
                    tag="p"
                    class="sv-subscription-cancellation-modal__explanation"
                >
                    {{ explanation }}
                </Typography>

                <Section
                    v-if="subscription"
                    no-spacing
                    class="sv-subscription-cancellation-modal__subscription"
                >
                    <SubscriptionSummary
                        :subscription="subscription"
                        :avatar="avatar"
                        :enabled-pricing-ids="enabledPricingIds"
                    />

                    <div
                        v-if="renewsOn || paymentMethod"
                        class="sv-subscription-cancellation-modal__meta flex flex-wrap items-center gap-x-6 gap-y-2 px-3 pb-2"
                    >
                        <div
                            v-if="renewsOn"
                            class="sv-subscription-cancellation-modal__renews flex gap-1"
                        >
                            <Typography
                                tag="span"
                                variant="body-xs"
                                color="secondary"
                                weight="semibold"
                            >
                                {{
                                    $t({
                                        defaultMessage: 'Renews',
                                        description:
                                            'Label before the date the subscription renews, shown in the cancel subscription modal',
                                        id: 'subscription_cancellation_modal.renews_label',
                                    })
                                }}
                            </Typography>
                            <Typography tag="span" variant="body-xs" color="secondary">
                                {{ renewsOn }}
                            </Typography>
                        </div>

                        <PaymentMethod
                            v-if="summaryPaymentMethod"
                            variant="condensed"
                            class="sv-subscription-cancellation-modal__payment-method"
                            :payment-method="summaryPaymentMethod"
                        />
                    </div>
                </Section>

                <ErrorNotification
                    v-if="hasFailed"
                    class="sv-subscription-cancellation-modal__error sv-error"
                    :title="errorMessage"
                />
            </div>
        </template>
    </Modal>
</template>
