<script setup lang="ts">
import { Button } from '@solvimon/ui';

const loadAdyen = () => {
    import('@adyen/adyen-web').then(module => module.AdyenCheckout).then(console.log);
}
const loadStripe = () => {
    import('@stripe/stripe-js').then(module => module.loadStripe).then(Stripe => Stripe('stripe-key'));
}
</script>

<template>
    <div>
        <Button @click="loadAdyen">Pay via Adyen</Button>
        <Button @click="loadStripe">Pay via Stripe</Button>
    </div>
</template>