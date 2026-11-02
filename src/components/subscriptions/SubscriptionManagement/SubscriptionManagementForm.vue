<script setup lang="ts">
import { computed, watch } from 'vue';
import { Divider, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { PaymentMethod, Pricing, PricingPlan } from '@solvimon/solvimon-types';
import type {
    SubscriptionManagementFormEmits,
    SubscriptionManagementFormProps,
} from './SubscriptionManagementForm.types';
import SubscriptionPlanSelector from './SubscriptionPlanSelector.vue';
import PricingGroupSingleEditor from '@/components/subscriptions/PlanCustomizationForm/PricingGroupSingleEditor.vue';
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector/PaymentMethodSelector.vue';

const props = withDefaults(defineProps<SubscriptionManagementFormProps>(), {
    canAddPaymentMethod: true,
});
const emit = defineEmits<SubscriptionManagementFormEmits>();

const enabledPricingIds = defineModel<Pricing['id'][]>('enabledPricingIds', { required: true });
const paymentMethodId = defineModel<PaymentMethod['id'] | undefined>('paymentMethodId');
const pricingPlanId = defineModel<PricingPlan['id'] | undefined>('pricingPlanId');

const { $t } = useIntl();

const toTime = (value?: string) => {
    const parsed = value ? Date.parse(value) : NaN;

    return Number.isFinite(parsed) ? parsed : 0;
};

/** Newest first, so a method the customer just added leads the list rather than trailing it. */
const sortedPaymentMethods = computed(() =>
    [...(props.paymentMethods ?? [])].sort((a, b) => toTime(b.created_at) - toTime(a.created_at)),
);

/**
 * Start on the customer's default payment method, falling back to the newest one — but prefer one
 * they have just added, since adding it was a deliberate act. Otherwise a choice they have already
 * made is left alone, so the list arriving late cannot overrule them.
 */
watch(
    () => props.paymentMethods,
    (paymentMethods, previousPaymentMethods) => {
        const addedPaymentMethod = paymentMethods?.find(
            ({ id }) => !previousPaymentMethods?.some((previous) => previous.id === id),
        );

        // Only a list that already had methods and then grew means the customer added one. Arriving
        // from nothing is the list loading, where the default should still win.
        if (addedPaymentMethod && previousPaymentMethods?.length) {
            paymentMethodId.value = addedPaymentMethod.id;
            return;
        }

        if (paymentMethods?.some(({ id }) => id === paymentMethodId.value)) {
            return;
        }

        paymentMethodId.value = (
            paymentMethods?.find(({ is_default }) => is_default) ?? sortedPaymentMethods.value[0]
        )?.id;
    },
    { immediate: true },
);
</script>

<template>
    <form :id="id" class="sv-subscription-management-form" @submit.prevent="emit('submit')">
        <div class="sv-subscription-management-form__body grid grid-cols-1 gap-4">
            <template v-if="planOptions && planOptions.length > 1">
                <SubscriptionPlanSelector
                    v-model:pricing-plan-id="pricingPlanId"
                    class="sv-subscription-management-form__plan"
                    :options="planOptions"
                    :disabled="disabled"
                    :avatar="avatar"
                />

                <div>
                    <Divider spacing="xs" />
                </div>
            </template>

            <PricingGroupSingleEditor
                v-if="pricingGroup"
                v-model="enabledPricingIds"
                class="sv-subscription-management-form__pricing-group"
                :group-name="pricingGroup.name"
                :pricings="pricingGroup.pricings"
                :billing-period="billingPeriod"
                :currency="currency"
            />

            <div v-if="pricingGroup">
                <Divider spacing="xs" />
            </div>

            <PaymentMethodSelector
                v-model="paymentMethodId"
                class="sv-subscription-management-form__payment-methods"
                :payment-methods="sortedPaymentMethods"
                required
                :show-add-option="canAddPaymentMethod"
                :disabled="disabled"
                :label="
                    $t({
                        defaultMessage: 'Saved payment methods',
                        id: 'subscription_management.payment_method_selector.saved_label',
                        description:
                            'Label above the payment method that pays for the subscription change',
                    })
                "
                @add-payment-method="emit('add-payment-method')"
            />

            <Typography
                v-if="hasExpiredPaymentMethod"
                :id="id && `${id}__expired-payment-method`"
                variant="body-sm"
                color="subtle"
                tag="p"
                class="sv-subscription-management-form__expired-payment-method"
            >
                {{
                    $t({
                        defaultMessage:
                            'The card this subscription is paid with has expired. Pick another payment method or add a new one.',
                        id: 'subscription_management.expired_payment_method_replace',
                        description:
                            'Shown under the payment method choice on the manage subscription screen when the card the subscription is paid with has expired',
                    })
                }}
            </Typography>
        </div>
    </form>
</template>
