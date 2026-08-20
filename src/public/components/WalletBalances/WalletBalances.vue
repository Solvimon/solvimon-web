<script setup lang="ts">
import type { WalletBalancesEmits, WalletBalancesProps } from './WalletBalances.types';
import CustomerWalletBalances from '@/public/components/CustomerWalletBalances/CustomerWalletBalances.vue';

defineProps<WalletBalancesProps>();
const emit = defineEmits<WalletBalancesEmits>();
</script>

<template>
    <CustomerWalletBalances
        class="sv-wallet-balances sv-root sv-component"
        :has-error="hasError"
        :is-loading="isLoading"
        :wallet-balances="walletBalances"
        :show-top-up-button="showTopUpButton"
        :customer="customer"
        :payment-methods="paymentMethods"
        :subscriptions="subscriptions"
        @top-up-charged="emit('top-up-charged')"
        @auto-top-up-saved="emit('auto-top-up-saved')"
        @auto-top-up-cancelled="emit('auto-top-up-cancelled')"
        @payment-method-stored="emit('payment-method-stored')"
        @payment-failed="(error) => emit('payment-failed', error)"
    />
</template>
