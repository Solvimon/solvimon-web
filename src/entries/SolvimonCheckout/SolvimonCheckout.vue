<script setup lang="ts">
import type { SolvimonCheckoutEmits, SolvimonCheckoutProps } from './SolvimonCheckout.types';
import Provider from '@/components/providers/Provider/Provider.vue';
import Checkout from '@/views/Checkout/Checkout.vue';

defineProps<Partial<SolvimonCheckoutProps>>();
defineEmits<SolvimonCheckoutEmits>();
</script>

<template>
    <Provider
        :environment="environment"
        :token="token"
        :locale="locale"
        :allowed-portal-url-types="['INIT_PRICING_PLAN_SUBSCRIPTION']"
        @error="(error) => $emit('error', error)"
    >
        <Checkout :email="email" :country-code="countryCode">
            <template v-if="$slots['terms-and-conditions']" #terms-and-conditions
                ><slot name="terms-and-conditions"
            /></template>
        </Checkout>
    </Provider>
</template>
