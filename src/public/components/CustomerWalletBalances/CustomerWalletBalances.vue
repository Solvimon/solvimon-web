<script setup lang="ts">
import { ErrorNotification, useIntl, WalletBalances } from '@solvimon/solvimon-ui';
import type {
    CustomerWalletBalancesEmits,
    CustomerWalletBalancesProps,
} from './CustomerWalletBalances.types';
import Skeleton from '@/components/shared/Skeleton.vue';

defineProps<CustomerWalletBalancesProps>();
defineEmits<CustomerWalletBalancesEmits>();

const { $t } = useIntl();
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="sv-wallet-balances sv-root sv-component sv-loading min-h-48"
        data-testid="customer-wallet-balances-skeleton"
    />
    <ErrorNotification
        v-else-if="hasError"
        class="sv-wallet-balances sv-root sv-component sv-error"
        :title="
            $t({
                defaultMessage: 'Could not load wallet balances',
                description: 'Error shown when wallet balances fail to load',
                id: 'wallet_balance.load_failed',
            })
        "
    />
    <WalletBalances
        v-else-if="walletBalances.length > 0"
        class="sv-wallet-balances sv-root sv-component"
        :customer-wallet-balances="walletBalances"
        :show-top-up-button="showTopUpButton"
        :title="
            $t(
                {
                    defaultMessage: '{count, plural, one {Wallet} other {Wallets}}',
                    description: 'Title for the wallets block on the customer overview page',
                    id: 'customer_overview.wallet_balances_block.title',
                },
                { count: String(walletBalances.length) },
            )
        "
        @top-up="$emit('top-up', $event)"
    />
</template>
