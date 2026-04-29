<script setup lang="ts">
import type { SolvimonWalletBalancesEntryProps } from './WalletBalances.entry.types';
import { useCustomerWalletBalances } from '@/composables/useCustomerWalletBalances';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { useWalletBalanceItems } from '@/composables/useWalletBalanceItems';

const props = defineProps<SolvimonWalletBalancesEntryProps>();

const customerId = props.portalObject.customer_id;

const customerWalletBalances = useCustomerWalletBalances({ customerId });
const walletBalanceItems = useWalletBalanceItems(customerWalletBalances.walletBalances);

const { isLoading } = useLoadInitialData(customerWalletBalances.fetch());
</script>

<template>
    <slot
        name="default"
        :customer-wallet-balances="customerWalletBalances"
        :wallet-balance-items="walletBalanceItems"
        :is-loading="isLoading"
    />
</template>
