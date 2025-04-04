<script setup lang="ts">
import type { PaymentProviderFormAdyenProps } from './PaymentProviderFormAdyen.types';

defineProps<PaymentProviderFormAdyenProps>();
</script>

<template>{{ paymentMethodOption }}</template>
