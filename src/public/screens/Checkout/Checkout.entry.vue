<script setup lang="ts">
import { isValidCountryCode } from '@solvimon/solvimon-ui';
import type { CountryCode } from '@solvimon/solvimon-types';
import type { SolvimonCheckoutEmits, SolvimonCheckoutEntryProps } from './Checkout.entry.types';
import { EntryProvider } from '@/components/providers';
import Checkout from '@/public/screens/Checkout/Checkout.vue';
import { useLogger } from '@/components/providers';
import { getQueryParam } from '@/utils/url';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('checkout');

const props = defineProps<SolvimonCheckoutEntryProps>();
const emit = defineEmits<SolvimonCheckoutEmits>();

const logger = useLogger();

const getValidCountryCode = (countryCode: CountryCode | undefined) => {
    if (countryCode) {
        if (isValidCountryCode(countryCode)) {
            return countryCode;
        }

        logger.error('INVALID_COUNTRY_CODE', `invalid country code provided: "${countryCode}"`);
        return undefined;
    }

    return undefined;
};

const getValidEmail = (email: string | undefined) => {
    if (email) {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return email;
        }

        logger.error('INVALID_EMAIL', `invalid email provided: "${email}"`);
        return undefined;
    }

    return undefined;
};

const validCountryCode = getValidCountryCode(props.configuration?.countryCode);
const validEmail = getValidEmail(props.configuration?.email);
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
                email: validEmail,
                countryCode: validCountryCode,
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
