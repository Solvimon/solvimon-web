<script setup lang="ts">
import { IntlProvider, InvoiceSummary } from '@solvimon/ui';
import ChildComponent from './ChildComponent.vue';
import invoice from '@/mockData/invoice';
</script>

<template>
    <IntlProvider locale="en">
        <h1 class="text-2xl">Invoice</h1>
        <InvoiceSummary
            :invoice="invoice"
            variant="interactive"
        />
        <ChildComponent/>
    </IntlProvider>
</template>

<style>
h1 { color: red; }
</style>