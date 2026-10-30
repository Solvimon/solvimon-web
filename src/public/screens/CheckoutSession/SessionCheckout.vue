<script setup lang="ts">
import { useCheckoutSession } from './useCheckoutSession';
import type { CheckoutEmits, CheckoutProps } from '@/public/screens/Checkout/Checkout.types';
import Checkout from '@/public/screens/Checkout/Checkout.vue';
import { useLogger } from '@/components/providers';

const props = defineProps<CheckoutProps & { portalUrlId: string }>();
const emit = defineEmits<CheckoutEmits>();

useLogger().info('COMPONENT_INITIALIZED', 'Checkout session component initialized');

const { source } = useCheckoutSession({ portalUrlId: props.portalUrlId });
</script>

<template>
    <Checkout
        :source="source"
        :configuration="configuration"
        @ready="emit('ready')"
        @error="emit('error', $event)"
    />
</template>
