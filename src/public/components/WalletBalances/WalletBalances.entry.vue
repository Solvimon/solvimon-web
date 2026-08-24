<script setup lang="ts">
import { ApiStatus } from '@solvimon/solvimon-types';
import type { SolvimonWalletBalancesEntryProps } from './WalletBalances.entry.types';
import WalletBalances from './WalletBalances.vue';
import WalletBalancesEntryView from './WalletBalances.entry.view.vue';
import { COMPONENT_NAME } from './WalletBalances.entry.ce';
import { EntryProvider } from '@/components/providers';

defineProps<SolvimonWalletBalancesEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <WalletBalancesEntryView v-bind="$props">
            <template #default="{ customerWalletBalances, walletBalanceItems, isLoading }">
                <WalletBalances
                    :has-error="customerWalletBalances.apiStatus.value === ApiStatus.Failed"
                    :is-loading="isLoading"
                    :wallet-balances="walletBalanceItems"
                />
            </template>
        </WalletBalancesEntryView>
    </EntryProvider>
</template>
