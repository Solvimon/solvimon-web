<script setup lang="ts">
import type { CheckoutEmits, CheckoutProps } from './Checkout.types';
import type { CheckoutSource } from './Checkout.source.types';
import Checkout from './Checkout.vue';
import { useCheckoutView } from './useCheckout.view';
import { useLogger } from '@/components/providers';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';
import { CodedError } from '@/utils/error';

const props = defineProps<CheckoutProps>();
const emit = defineEmits<CheckoutEmits>();
const portal = usePortal();

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

const source: CheckoutSource = {
    ...view,
    isShippingAddressRequired,
    successUrl: init?.success_url,
    note: init?.note,
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
