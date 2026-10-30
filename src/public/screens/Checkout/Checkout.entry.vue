<script setup lang="ts">
import { computed } from 'vue';
import type { SolvimonCheckoutEmits, SolvimonCheckoutEntryProps } from './Checkout.entry.types';
import CheckoutNotAvailable from '@/components/checkout/CheckoutNotAvailable.vue';
import { EntryProvider } from '@/components/providers';
import LegacyCheckout from '@/public/screens/Checkout/LegacyCheckout.vue';
import { sanitizeCouponCode } from '@/public/screens/Checkout/couponCode';
import { getQueryParam } from '@/utils/url';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('checkout');

const props = defineProps<SolvimonCheckoutEntryProps>();
const emit = defineEmits<SolvimonCheckoutEmits>();

const couponCode = computed(
    () => props.configuration?.couponCode ?? sanitizeCouponCode(getQueryParam('coupon_code')),
);
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['INIT_PRICING_PLAN_SUBSCRIPTION']"
        @error="(error) => $emit('error', error)"
    >
        <LegacyCheckout
            :configuration="{
                avatar: branding?.emblem?.public_url,
                email: configuration?.email,
                countryCode: configuration?.countryCode,
                enabledPricingIds: configuration?.enabledPricingIds,
                couponCode,
            }"
            @ready="emit('ready')"
        >
            <template v-if="$slots['terms-and-conditions']" #terms-and-conditions
                ><slot name="terms-and-conditions"
            /></template>
        </LegacyCheckout>
        <template #portal-unavailable>
            <CheckoutNotAvailable class="sv-checkout sv-root sv-screen sv-checkout--error" />
        </template>
    </EntryProvider>
</template>
