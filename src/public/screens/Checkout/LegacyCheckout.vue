<script setup lang="ts">
import { useIntl } from '@solvimon/solvimon-ui';
import { ref, watch } from 'vue';
import type { CheckoutEmits, CheckoutProps } from './Checkout.types';
import type { CheckoutSource } from './Checkout.source.types';
import Checkout from './Checkout.vue';
import { useCheckoutView } from './useCheckout.view';
import { useLogger } from '@/components/providers';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';
import { CodedError } from '@/utils/error';
import { usePromotionCode } from '@/composables/usePromotionCode';
import { useAutoApplyPromotionCode } from '@/composables/useAutoApplyPromotionCode';

const props = defineProps<CheckoutProps>();
const emit = defineEmits<CheckoutEmits>();
const portal = usePortal();
const { $t } = useIntl();

useLogger().info('COMPONENT_INITIALIZED', 'Checkout component initialized');

// Nothing below works with another portal object, so the setup stops here. The error boundary
// reports it, once, under this code.
if (portal.value?.type !== 'INIT_PRICING_PLAN_SUBSCRIPTION') {
    throw new CodedError('INVALID_TOKEN', 'Invalid token');
}

const init = portal.value?.init_pricing_plan_subscription;
const isShippingAddressRequired = init?.use_shipping_addresses === true;

const view = useCheckoutView({
    initialCountry: props.configuration?.countryCode,
    initialEmail: props.configuration?.email,
    subscriptionId: init?.pricing_plan_subscription_id,
    enabledPricingIds: props.configuration?.enabledPricingIds,
    isShippingAddressRequired,
});

const promotionCode = ref<string | null>(null);

// The code the preview and the payment are priced with can also come from a redirect return.
watch(
    () => view.checkoutForm.form.value.promotionCode,
    (code) => {
        promotionCode.value = code ?? null;
    },
);

const {
    applyPromotionCode,
    removePromotionCode,
    isPromotionCodePending,
    promotionCodeErrorMessage,
} = usePromotionCode({
    checkoutForm: view.checkoutForm,
    updateInvoicePreviewOnBillingInformationChange:
        view.updateInvoicePreviewOnBillingInformationChange,
    formatErrorMessage: ({ action }) =>
        action === 'apply'
            ? $t({
                  defaultMessage: 'Promotion code could not be applied. Please try again.',
                  id: 'checkout.promotion_code.apply_failed',
                  description: 'Error message when applying a promotion code in checkout failed',
              })
            : $t({
                  defaultMessage: 'Promotion code could not be removed. Please try again.',
                  id: 'checkout.promotion_code.remove_failed',
                  description: 'Error message when removing a promotion code in checkout failed',
              }),
    onInvalidPromotionCode: () => {
        promotionCode.value = null;
    },
    onApplyError: () => {
        promotionCode.value = null;
    },
});

useAutoApplyPromotionCode({
    subscription: view.subscription,
    promotionCode: () => props.configuration?.couponCode,
    appliedPromotionCode: promotionCode,
    applyPromotionCode,
});

const source: CheckoutSource = {
    ...view,
    isShippingAddressRequired,
    promotionCode: {
        code: promotionCode,
        isPending: isPromotionCodePending,
        errorMessage: promotionCodeErrorMessage,
        apply: applyPromotionCode,
        remove: () => removePromotionCode(),
    },
    payment: {
        paymentMethodOptions: view.paymentMethodOptions,
        isPaymentMethodsPending: view.isPaymentMethodsPending,
        hasPaymentMethodOptionsError: view.hasPaymentMethodOptionsError,
        retryPaymentMethodOptions: view.retryPaymentMethodOptions,
        authorizationContext: view.authorizationContext,
        updateInvoicePreviewOnBillingInformationChange:
            view.updateInvoicePreviewOnBillingInformationChange,
    },
    successUrl: ref(init?.success_url),
    note: ref(init?.note),
};
</script>

<template>
    <Checkout
        :source="source"
        :configuration="configuration"
        @ready="emit('ready')"
        @error="emit('error', $event)"
    />
</template>
