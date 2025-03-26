<script setup lang="ts">
import { InvoiceSummary } from '@solvimon/ui';
import ChildComponent from './ChildComponent.vue';
import invoice from '@/mockData/invoice';
</script>

<template>
    <h1 class="text-2xl">Invoice</h1>
    <InvoiceSummary
        :invoice="invoice"
        variant="interactive"
    />
    <ChildComponent/>
</template>

<style>
h1 { color: red; }
</style>