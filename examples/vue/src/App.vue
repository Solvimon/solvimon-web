<script setup lang="ts">
import { SolvimonAddPaymentMethodForm } from '@solvimon/sdk/solvimon-add-payment-method-form';

if (customElements.get('solvimon-add-payment-method-form')) {
    customElements.define('solvimon-add-payment-method-form', SolvimonAddPaymentMethodForm);
}
</script>

<template>
    <solvimon-add-payment-method-form
        token="S3JZMVgyZEVhZkduaFZkcWhLMncxRTZLa2NTQ0x3cDkucHVybF9td0RlZUEwdUhvc3ZWT0FSZTQxcg=="
        environment="DEV"
    />
</template>
