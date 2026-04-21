<script setup lang="ts">
import { isValidCountryCode } from '@solvimon/ui';
import type { CountryCode } from '@solvimon/types';
import type { SolvimonCheckoutEmits, SolvimonCheckoutEntryProps } from './Checkout.entry.types';
import { COMPONENT_NAME } from './Checkout.entry.ce';
import Provider from '@/components/providers/Provider/Provider.vue';
import Checkout from '@/public/screens/Checkout/Checkout.vue';
import { useLogger } from '@/components/providers';

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
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['INIT_PRICING_PLAN_SUBSCRIPTION']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        :on-log="onLog"
        @error="(error) => $emit('error', error)"
    >
        <Checkout
            :avatar="branding?.emblem?.public_url"
            :email="validEmail"
            :country-code="validCountryCode"
            :enabled-pricing-ids="configuration?.enabledPricingIds"
            @ready="emit('ready')"
        >
            <template v-if="$slots['terms-and-conditions']" #terms-and-conditions
                ><slot name="terms-and-conditions"
            /></template>
        </Checkout>
    </Provider>
</template>
