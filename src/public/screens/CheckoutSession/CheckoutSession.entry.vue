<script setup lang="ts">
import type {
    SolvimonCheckoutSessionEmits,
    SolvimonCheckoutSessionEntryProps,
} from './CheckoutSession.entry.types';
import SessionCheckout from './SessionCheckout.vue';
import CheckoutSessionEnded from './CheckoutSessionEnded.vue';
import CheckoutNotAvailable from '@/components/checkout/CheckoutNotAvailable.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('checkout-session');

defineProps<SolvimonCheckoutSessionEntryProps>();
const emit = defineEmits<SolvimonCheckoutSessionEmits>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CHECKOUT_SESSION']"
        @error="(error) => $emit('error', error)"
    >
        <SessionCheckout
            :portal-url-id="portalObject.id"
            :configuration="{ avatar: branding?.emblem?.public_url }"
            @ready="emit('ready')"
        />
        <template #portal-unavailable="{ ending }">
            <CheckoutSessionEnded
                v-if="ending"
                class="sv-checkout sv-root sv-screen"
                :reason="ending.reason"
                :status="ending.checkoutSessionStatus"
            />
            <CheckoutNotAvailable v-else class="sv-checkout sv-root sv-screen sv-checkout--error" />
        </template>
    </EntryProvider>
</template>
