<script setup lang="ts">
import type { BillingInformationFormProps } from './BillingInformationForm.types';
import InternalBillingInformationForm from '@/components/customer/BillingInformationForm/BillingInformationForm.vue';

defineProps<BillingInformationFormProps>();
</script>

<template>
    <InternalBillingInformationForm
        class="sv-billing-form sv-root sv-component"
        :customer="customer"
        :update-customer="updateCustomer"
        :is-loading="isLoading"
        :api-error="apiError"
    />
</template>
