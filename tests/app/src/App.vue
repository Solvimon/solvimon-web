<script setup lang="ts">
import { createSolvimonCore } from '@solvimon/solvimon-web/core';
import type { Environment } from '@solvimon/solvimon-types';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const checkoutContainer = ref<HTMLDivElement | null>(null);

const handleError = (error: Error) => {
    console.error(error);
};

const email = computed(() => {
    return new URLSearchParams(window.location.search).get('email') ?? undefined;
});

const country = computed(() => {
    return new URLSearchParams(window.location.search).get('country') ?? undefined;
});

const portalObject = {
    object_type: 'PORTAL_URL',
    id: 'purl_PwDmbS0v5xMRnNCvrp14',
    type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
    pricing_plan_id: 'ppl_example',
    token: 'WkM0ZHh1czVrTnBUWEhDbW9BQ3hJSmVMTHJONFFaNHEucHVybF9Qd0RtYlMwdjV4TVJuTkN2cnAxNA==',
    status: 'PUBLISHED',
};

const solvimon = createSolvimonCore({
    environment: 'DEV' as Environment,
    locale: 'en-US',
    logLevel: 'info',
    onError: handleError,
});

let unmountCheckout: (() => void) | null = null;

onMounted(() => {
    if (!checkoutContainer.value) return;

    unmountCheckout = solvimon.createScreen('checkout', {
        container: checkoutContainer.value,
        portalObject,
        configuration: {
            email: email.value,
            countryCode: country.value ?? undefined,
        },
    });
});

onUnmounted(() => {
    unmountCheckout?.();
});
</script>

<template>
    <div class="app">
        <h1>Solvimon Checkout Test App</h1>
        <div ref="checkoutContainer" class="checkout-root" />
    </div>
</template>

<style scoped>
.app {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
}

h1 {
    margin-bottom: 2rem;
}

.checkout-root {
    min-height: 320px;
}
</style>
