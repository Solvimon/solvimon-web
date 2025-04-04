<script setup lang="ts">
import { InvoiceSummary } from '@solvimon/ui';
import { getInvoice } from '@/services/invoices';
import { useData } from '@/utils/useData';

const { data, isPending } = useData(() => getInvoice('invo_awDeek0uHooKHCAWB419'));
</script>

<template>
    <p v-if="isPending">Loading...</p>
    <InvoiceSummary v-if="data" :invoice="data" variant="interactive" />
</template>
