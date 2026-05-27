<script setup lang="ts">
import { WalletBalances, useIntl } from '@solvimon/solvimon-ui';
import type { CustomerWalletBalancesBlockProps } from './CustomerWalletBalancesBlock.types';

defineProps<CustomerWalletBalancesBlockProps>();

const { $t } = useIntl();
</script>

<template>
    <WalletBalances
        class="sv-wallet-balances"
        :items="walletBalances"
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
    />
</template>
