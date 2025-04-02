<script setup lang="ts">
import Invoice from '@/components/Invoice/Invoice.vue';
import Provider from '@/components/Provider/Provider.vue';
import type { Environment } from '@solvimon/types';

defineProps<{ token: string; environment: Environment }>();
</script>

<template>
    <Provider :environment="environment" :token="token" locale="en">
        <Invoice />
    </Provider>
</template>