<script setup lang="ts">
import { computed, watch } from 'vue';
import { Divider, useIntl } from '@solvimon/solvimon-ui';
import type { PaymentMethod, Pricing } from '@solvimon/solvimon-types';
import type {
    SubscriptionManagementFormEmits,
    SubscriptionManagementFormProps,
} from './SubscriptionManagementForm.types';
import PricingGroupSingleEditor from '@/components/subscriptions/PlanCustomizationForm/PricingGroupSingleEditor.vue';
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector/PaymentMethodSelector.vue';

const props = defineProps<SubscriptionManagementFormProps>();
const emit = defineEmits<SubscriptionManagementFormEmits>();

const enabledPricingIds = defineModel<Pricing['id'][]>('enabledPricingIds', { required: true });
const paymentMethodId = defineModel<PaymentMethod['id'] | undefined>('paymentMethodId');

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
    <form class="sv-subscription-management-form" @submit.prevent>
        <div class="sv-subscription-management-form__body grid grid-cols-1 gap-4">
            <PricingGroupSingleEditor
                v-model="enabledPricingIds"
                class="sv-subscription-management-form__pricing-group"
                :group-name="pricingGroup.name"
                :pricings="pricingGroup.pricings"
                :billing-period="billingPeriod"
                :currency="currency"
            />

            <div>
                <Divider spacing="xs" />
            </div>

            <PaymentMethodSelector
                v-model="paymentMethodId"
                class="sv-subscription-management-form__payment-methods"
                :payment-methods="sortedPaymentMethods"
                :payment-method-options="paymentMethodOptions"
                required
                :disabled="disabled"
                :label="
                    $t({
                        defaultMessage: 'Payment method',
                        id: 'subscription_management.payment_method_selector.label',
                        description:
                            'Label above the payment method that pays for the subscription change',
                    })
                "
                @add-payment-method="emit('add-payment-method')"
            />
        </div>
    </form>
</template>
