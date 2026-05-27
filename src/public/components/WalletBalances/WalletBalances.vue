<script setup lang="ts">
import type { WalletBalancesProps } from './WalletBalances.types';
import CustomerWalletBalances from '@/public/components/CustomerWalletBalances/CustomerWalletBalances.vue';

defineProps<WalletBalancesProps>();
</script>

<template>
    <CustomerWalletBalances
        class="sv-wallet-balances sv-root sv-component"
        :has-error="hasError"
        :is-loading="isLoading"
        :wallet-balances="walletBalances"
    />
</template>
