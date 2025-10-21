<script setup lang="ts">
import { isValidCountryCode } from '@solvimon/ui';
import type { SolvimonCheckoutEmits, SolvimonCheckoutProps } from './SolvimonCheckout.types';
import Provider from '@/components/providers/Provider/Provider.vue';
import Checkout from '@/views/Checkout/Checkout.vue';

const props = defineProps<Partial<SolvimonCheckoutProps>>();
defineEmits<SolvimonCheckoutEmits>();

if (props.countryCode && !isValidCountryCode(props.countryCode)) {
    throw new Error(`invalid country code provided: "${props.countryCode}"`);
}
</script>

<template>
    <Provider
        :environment="environment"
        :token="token"
        :locale="locale"
        :allowed-portal-url-types="['INIT_PRICING_PLAN_SUBSCRIPTION']"
        @error="(error) => $emit('error', error)"
    >
        <Checkout
            :avatar="avatar"
            :email="email"
            :country-code="countryCode"
            :enabled-pricing-ids="enabledPricingIds"
        >
            <template v-if="$slots['terms-and-conditions']" #terms-and-conditions
                ><slot name="terms-and-conditions"
            /></template>
        </Checkout>
    </Provider>
</template>
