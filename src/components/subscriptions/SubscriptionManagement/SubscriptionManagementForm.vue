<script setup lang="ts">
import { toRef } from 'vue';
import { Divider, useIntl } from '@solvimon/solvimon-ui';
import type { PaymentMethod, Pricing, PricingPlan } from '@solvimon/solvimon-types';
import type {
    SubscriptionManagementFormEmits,
    SubscriptionManagementFormProps,
} from './SubscriptionManagementForm.types';
import SubscriptionPlanSelector from './SubscriptionPlanSelector.vue';
import PricingGroupSingleEditor from '@/components/subscriptions/PlanCustomizationForm/PricingGroupSingleEditor.vue';
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector/PaymentMethodSelector.vue';
import { useDefaultPaymentMethod } from '@/composables/useDefaultPaymentMethod';

const props = withDefaults(defineProps<SubscriptionManagementFormProps>(), {
    canAddPaymentMethod: true,
});
const emit = defineEmits<SubscriptionManagementFormEmits>();

const enabledPricingIds = defineModel<Pricing['id'][]>('enabledPricingIds', { required: true });
const paymentMethodId = defineModel<PaymentMethod['id'] | undefined>('paymentMethodId');
const pricingPlanId = defineModel<PricingPlan['id'] | undefined>('pricingPlanId');

const { $t } = useIntl();

const { sortedPaymentMethods } = useDefaultPaymentMethod({
    paymentMethods: toRef(props, 'paymentMethods'),
    selectedPaymentMethodId: paymentMethodId,
});
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
        </div>
    </form>
</template>
