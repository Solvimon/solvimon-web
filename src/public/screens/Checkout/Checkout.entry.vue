<script setup lang="ts">
import type { SolvimonCheckoutEmits, SolvimonCheckoutEntryProps } from './Checkout.entry.types';
import { EntryProvider } from '@/components/providers';
import Checkout from '@/public/screens/Checkout/Checkout.vue';
import { getQueryParam } from '@/utils/url';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('checkout');

const props = defineProps<SolvimonCheckoutEntryProps>();
const emit = defineEmits<SolvimonCheckoutEmits>();

const couponCode = props.configuration?.couponCode ?? getQueryParam('coupon_code') ?? undefined;
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['INIT_PRICING_PLAN_SUBSCRIPTION']"
        @error="(error) => $emit('error', error)"
    >
        <Checkout
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
        </Checkout>
    </EntryProvider>
</template>
