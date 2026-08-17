<script setup lang="ts">
import { ErrorNotification, useIntl, WalletBalances } from '@solvimon/solvimon-ui';
import type { CustomerWalletBalanceItem } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import type {
    CustomerWalletBalancesEmits,
    CustomerWalletBalancesProps,
} from './CustomerWalletBalances.types';
import Skeleton from '@/components/shared/Skeleton.vue';
import TopUpModal from '@/components/wallets/TopUpModal/TopUpModal.vue';
import { useTopUpModal } from '@/components/wallets/TopUpModal/useTopUpModal';

/**
 * The modal makes this component multi-root, which would drop the class the screens style the block
 * with. The three branches are a v-if chain, so binding the attrs on each still lands them on
 * whichever one root renders.
 */
defineOptions({ inheritAttrs: false });

defineProps<CustomerWalletBalancesProps>();
const emit = defineEmits<CustomerWalletBalancesEmits>();

const { $t } = useIntl();

/**
 * Which wallet is being topped up, and so whether the modal is open at all. Kept here rather than
 * by the screen: the button that opens it is one of these rows, and every screen showing them
 * wired up the same modal behind it.
 */
const selectedBalanceItem = ref<CustomerWalletBalanceItem | undefined>();

const topUpModal = useTopUpModal(selectedBalanceItem);
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        v-bind="$attrs"
        class="sv-wallet-balances sv-root sv-component sv-loading min-h-48"
        data-testid="customer-wallet-balances-skeleton"
    />
    <ErrorNotification
        v-else-if="hasError"
        v-bind="$attrs"
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
        v-bind="$attrs"
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
        @top-up="selectedBalanceItem = $event"
    />

    <!--
        Only built where topping up is offered: the modal starts up the invoice and payment method
        services, which is not worth doing for a screen that only reads balances out.
    -->
    <TopUpModal
        v-if="showTopUpButton"
        :show-modal="topUpModal.showModal.value"
        :selected-balance-item="selectedBalanceItem"
        :payment-methods="paymentMethods"
        :customer="customer"
        :subscriptions="subscriptions"
        @close="selectedBalanceItem = undefined"
        @confirm="emit('top-up-charged')"
        @payment-success="emit('payment-method-stored')"
        @payment-failed="(error) => emit('payment-failed', error)"
    />
</template>
