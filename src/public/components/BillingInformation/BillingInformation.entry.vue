<script setup lang="ts">
import BillingInformation from './BillingInformation.vue';
import type { SolvimonBillingInformationEntryProps } from './BillingInformation.entry.types';
import BillingInformationView from './BillingInformation.entry.view.vue';

defineProps<Partial<SolvimonBillingInformationEntryProps>>();
</script>

<template>
    <BillingInformationView>
        <template #default="{ customer }">
            <BillingInformation
                v-if="customer.customer.value"
                :is-loading="customer.isPending.value"
                :customer="customer.customer.value"
            />
        </template>
    </BillingInformationView>
</template>
