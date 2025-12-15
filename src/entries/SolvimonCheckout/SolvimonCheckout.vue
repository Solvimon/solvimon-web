<script setup lang="ts">
import { isValidCountryCode } from '@solvimon/ui';
import type { CountryCode } from '@solvimon/types';
import type { SolvimonCheckoutEmits, SolvimonCheckoutProps } from './SolvimonCheckout.types';
import Provider from '@/components/providers/Provider/Provider.vue';
import Checkout from '@/views/Checkout/Checkout.vue';

const props = defineProps<Partial<SolvimonCheckoutProps>>();
const emit = defineEmits<SolvimonCheckoutEmits>();

const getValidCountryCode = (countryCode: CountryCode | undefined) => {
    if (countryCode) {
        if (isValidCountryCode(countryCode)) {
            return countryCode;
        }

        emit('error', new Error(`invalid country code provided: "${countryCode}"`));
        return undefined;
    }

    return undefined;
};

const getValidEmail = (email: string | undefined) => {
    if (email) {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return email;
        }

        emit('error', new Error(`invalid email provided: "${email}"`));
        return undefined;
    }

    return undefined;
};

const validCountryCode = getValidCountryCode(props.countryCode);
const validEmail = getValidEmail(props.email);
</script>

<template>
    <Provider
        :environment="environment"
        :token="token || portalObject?.token"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-url-types="['INIT_PRICING_PLAN_SUBSCRIPTION']"
        @error="(error) => $emit('error', error)"
    >
        <Checkout
            :avatar="branding?.emblem?.public_url"
            :email="validEmail"
            :country-code="validCountryCode"
            :enabled-pricing-ids="enabledPricingIds"
            @ready="emit('ready')"
        >
            <template v-if="$slots['terms-and-conditions']" #terms-and-conditions
                ><slot name="terms-and-conditions"
            /></template>
        </Checkout>
    </Provider>
</template>
