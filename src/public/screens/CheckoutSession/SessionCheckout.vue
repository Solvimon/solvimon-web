<script setup lang="ts">
import { useCheckoutSession } from './useCheckoutSession';
import CheckoutSessionEnded from './CheckoutSessionEnded.vue';
import type { CheckoutEmits, CheckoutProps } from '@/public/screens/Checkout/Checkout.types';
import Checkout from '@/public/screens/Checkout/Checkout.vue';
import CheckoutNotAvailable from '@/components/checkout/CheckoutNotAvailable.vue';
import { useLogger } from '@/components/providers';

const props = defineProps<CheckoutProps & { portalUrlId: string }>();
const emit = defineEmits<CheckoutEmits>();

useLogger().info('COMPONENT_INITIALIZED', 'Checkout session component initialized');

const { source, endState, isRedirecting, loadFailure } = useCheckoutSession({
    portalUrlId: props.portalUrlId,
});
</script>

<template>
    <CheckoutSessionEnded
        v-if="loadFailure?.reason"
        class="sv-checkout sv-root sv-screen"
        :reason="loadFailure.reason"
        :status="loadFailure.status"
    />
    <CheckoutNotAvailable
        v-else-if="loadFailure"
        class="sv-checkout sv-root sv-screen sv-checkout--error"
    />
    <CheckoutSessionEnded
        v-else-if="endState"
        class="sv-checkout sv-root sv-screen"
        :status="endState"
        :is-redirecting="isRedirecting"
    />
    <Checkout
        v-else
        :source="source"
        :configuration="configuration"
        @ready="emit('ready')"
        @error="emit('error', $event)"
    />
</template>
