<script setup lang="ts">
import { useAuth } from '@/components/AuthProvider';
import { getInvoice } from '@/services/invoices';
import { useData } from '@/utils/useData';
import { InvoiceSummary } from '@solvimon/ui';

const auth = useAuth();
const { data, isPending } = useData(() => getInvoice('invo_jwDeek0uG4Zm9dAxu01q'));

</script>

<template>
    <p v-if="isPending">Loading...</p>
    <InvoiceSummary
        v-if="data"
        :invoice="data"
        variant="interactive"
    />
</template>