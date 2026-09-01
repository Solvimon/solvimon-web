<script setup lang="ts">
import { ApiStatus } from '@solvimon/solvimon-types';
import type { SolvimonWalletBalancesEntryProps } from './WalletBalances.entry.types';
import WalletBalances from './WalletBalances.vue';
import WalletBalancesEntryView from './WalletBalances.entry.view.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('wallet-balances');

defineProps<SolvimonWalletBalancesEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
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
