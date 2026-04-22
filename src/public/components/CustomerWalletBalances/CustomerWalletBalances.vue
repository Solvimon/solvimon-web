<script setup lang="ts">
import { ErrorNotification, useIntl } from '@solvimon/ui';
import type { CustomerWalletBalancesProps } from './CustomerWalletBalances.types';
import CustomerWalletBalancesBlock from '@/components/customer/CustomerWalletBalancesBlock/CustomerWalletBalancesBlock.vue';
import Skeleton from '@/components/shared/Skeleton.vue';

defineProps<CustomerWalletBalancesProps>();

const { $t } = useIntl();
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="min-h-48"
        data-testid="customer-wallet-balances-skeleton"
    />
    <ErrorNotification
        v-else-if="hasError"
        :title="
            $t({
                defaultMessage: 'Could not load wallet balances',
                description: 'Error shown when wallet balances fail to load',
                id: 'wallet_balance.load_failed',
            })
        "
    />
    <CustomerWalletBalancesBlock
        v-else-if="walletBalances.length > 0"
        :wallet-balances="walletBalances"
    />
</template>
