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
import { createSubscriptionsService } from '@/services/subscriptions';
import SubscriptionSummary from '@/components/subscriptions/SubscriptionSummary.vue';
import { getMostRecentScheduleInfo } from '@/utils/subscription';
import { usePaymentMethod } from '@/composables/usePaymentMethod';
import { useLogger } from '@/components/providers';

const props = defineProps<SubscriptionCancellationModalProps>();
const emit = defineEmits<SubscriptionCancellationModalEmits>();

const { $t, formatDate } = useIntl();
const logger = useLogger();

const { setSubscriptionCancellation } = createSubscriptionsService();

const variant = computed(() => props.variant);

const renewableUntil = computed(() => {
    const periods = props.subscription?.inactive_periods ?? [];
    const cancellation = periods.find(({ type }) => type === 'CANCEL') ?? periods[0];

    if (!cancellation) return undefined;

    return formatDate({
        date: cancellation.start_at,
        format: 'date',
        offsetType: 'local',
    });
});

const billingPeriodEndsAt = computed(() => {
    const invoiceDate = props.subscription?.next_invoice?.invoice_date;

    if (!invoiceDate) return undefined;

    return formatDate({
        date: invoiceDate,
        format: 'date',
        offsetType: 'local',
    });
});

const renewsOn = billingPeriodEndsAt;

const enabledPricingIds = computed(() =>
    (getMostRecentScheduleInfo(props.subscription)?.pricing_plan_schedule?.enabled_pricings ?? [])
        .map(({ pricing_id }) => pricing_id)
        .filter((pricingId): pricingId is Pricing['id'] => Boolean(pricingId)),
);

const { title, explanation, confirmButtonText, cancelButtonText, errorMessage } =
    useSubscriptionCancellationModalLabels({ variant, renewableUntil, billingPeriodEndsAt });

const { paymentMethod, get: fetchPaymentMethod } = usePaymentMethod();

watch(
    [
        () => props.showModal,
        () => props.subscription?.payment_method_id,
        () => props.subscription?.customer_id,
    ],
    ([showModal, paymentMethodId, customerId]) => {
        if (!showModal || !paymentMethodId || !customerId) return;
        if (paymentMethodId === paymentMethod.value?.id) return;

        void fetchPaymentMethod({ customerId, paymentMethodId }).catch(() => undefined);
    },
    { immediate: true },
);

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
                    shade="lighter"
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
                                shade="light"
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
                            <Typography tag="span" variant="body-xs" shade="light">
                                {{ renewsOn }}
                            </Typography>
                        </div>

                        <PaymentMethod
                            v-if="paymentMethod"
                            variant="condensed"
                            class="sv-subscription-cancellation-modal__payment-method"
                            :payment-method="paymentMethod"
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
