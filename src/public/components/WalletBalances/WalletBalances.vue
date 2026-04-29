<script setup lang="ts">
import type { WalletBalancesProps } from './WalletBalances.types';
import CustomerWalletBalances from '@/public/components/CustomerWalletBalances/CustomerWalletBalances.vue';

defineProps<WalletBalancesProps>();
</script>

<template>
    <CustomerWalletBalances
        :has-error="hasError"
        :is-loading="isLoading"
        :wallet-balances="walletBalances"
    />
</template>
