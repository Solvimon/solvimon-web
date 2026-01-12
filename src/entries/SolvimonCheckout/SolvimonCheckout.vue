<script setup lang="ts">
import { isValidCountryCode } from '@solvimon/ui';
import type { CountryCode } from '@solvimon/types';
import { getCurrentInstance, onMounted } from 'vue';
import type { SolvimonCheckoutEmits, SolvimonCheckoutProps } from './SolvimonCheckout.types';
import { COMPONENT_NAME } from './SolvimonCheckout.ce';
import Provider from '@/components/providers/Provider/Provider.vue';
import Checkout from '@/views/Checkout/Checkout.vue';
import { useLogger } from '@/components/providers';
import type { LogEntry } from '@/components/providers/LoggerProvider/LoggerProvider.types';

const props = defineProps<Partial<SolvimonCheckoutProps>>();
const emit = defineEmits<SolvimonCheckoutEmits>();

const logger = useLogger();
const instance = getCurrentInstance();
let hostElement: HTMLElement | null = null;

onMounted(() => {
    // Get the custom element host (the actual <solvimon-checkout> element)
    hostElement = instance?.vnode.el?.getRootNode()?.host as HTMLElement | null;
});

// Create a wrapper for onLog that dispatches a CustomEvent
const handleLogWrapper = (entry: LogEntry) => {
    if (props.onLog) {
        // Call the original callback
        props.onLog(entry);
    }

    // Also dispatch a CustomEvent for custom element compatibility
    const target = hostElement || instance?.vnode.el?.getRootNode()?.host;
    if (target) {
        const event = new CustomEvent('log', {
            detail: {
                code: entry.code,
                message: entry.message,
                context: entry.context,
            },
            bubbles: true,
            cancelable: true,
            composed: true,
        });
        target.dispatchEvent(event);
    }
};

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

const validCountryCode = getValidCountryCode(props.countryCode);
const validEmail = getValidEmail(props.email);
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :token="token || portalObject?.token"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['INIT_PRICING_PLAN_SUBSCRIPTION']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        :on-log="handleLogWrapper"
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
