<script setup lang="ts">
import type { SolvimonWalletBalancesEntryProps } from './WalletBalances.entry.types';
import { useCustomerWalletBalances } from '@/composables/useCustomerWalletBalances';
import { useLoadInitialData } from '@/composables/useLoadInitialData';

const props = defineProps<SolvimonWalletBalancesEntryProps>();

const customerId = props.portalObject.customer_id;

const customerWalletBalances = useCustomerWalletBalances({ customerId });

const { walletBalances } = customerWalletBalances;

const { isLoading } = useLoadInitialData(customerWalletBalances.fetch());
</script>

<template>
    <slot
        name="default"
        :customer-wallet-balances="customerWalletBalances"
        :wallet-balance-items="walletBalances?.wallet_balances ?? []"
        :is-loading="isLoading"
    />
</template>
