<script setup lang="ts">
import { defineSolvimonCheckout } from '@solvimon/sdk/screens/checkout';
import { computed } from 'vue';

// Define the custom element
defineSolvimonCheckout();

const handleError = (error: Error) => {
    console.error(error);
};

const email = computed(() => {
    return new URLSearchParams(window.location.search).get('email');
});

const country = computed(() => {
    return new URLSearchParams(window.location.search).get('country');
});
</script>

<template>
    <div class="app">
        <h1>Solvimon Checkout Test App</h1>
        <solvimon-checkout
            token="WkM0ZHh1czVrTnBUWEhDbW9BQ3hJSmVMTHJONFFaNHEucHVybF9Qd0RtYlMwdjV4TVJuTkN2cnAxNA=="
            environment="CI"
            :allowed-portal-types="['INIT_PRICING_PLAN_SUBSCRIPTION']"
            :email="email"
            :country-code="country"
            @error="handleError"
        />
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
</style>
