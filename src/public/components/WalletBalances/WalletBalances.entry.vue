<script setup lang="ts">
import { ApiStatus } from '@solvimon/solvimon-types';
import type { SolvimonWalletBalancesEntryProps } from './WalletBalances.entry.types';
import WalletBalances from './WalletBalances.vue';
import WalletBalancesEntryView from './WalletBalances.entry.view.vue';
import { COMPONENT_NAME } from './WalletBalances.entry.ce';
import { Provider } from '@/components/providers';

defineProps<SolvimonWalletBalancesEntryProps>();
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['CUSTOMER']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        :on-log="onLog"
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
    </Provider>
</template>
