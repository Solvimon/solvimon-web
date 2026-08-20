<script setup lang="ts">
import { ErrorNotification, useIntl, WalletBalances } from '@solvimon/solvimon-ui';
import type { ChargeOnDemandPricingItem, WalletAutoTopUpConfig } from '@solvimon/solvimon-types';
import { computed, ref } from 'vue';
import type {
    CustomerWalletBalancesEmits,
    CustomerWalletBalancesProps,
} from './CustomerWalletBalances.types';
import { getWalletBalanceForTopUpItem } from './CustomerWalletBalances.lib';
import Skeleton from '@/components/shared/Skeleton.vue';
import TopUpModal from '@/components/wallets/TopUpModal/TopUpModal.vue';
import AutoTopUpModal from '@/components/wallets/AutoTopUpModal/AutoTopUpModal.vue';
import AutoTopUpCancellationModal from '@/components/wallets/AutoTopUpCancellationModal/AutoTopUpCancellationModal.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps<CustomerWalletBalancesProps>();
const emit = defineEmits<CustomerWalletBalancesEmits>();

const { $t } = useIntl();

const selectedTopUpItem = ref<ChargeOnDemandPricingItem | undefined>();

const selectedBalanceItem = computed(() =>
    getWalletBalanceForTopUpItem(props.walletBalances, selectedTopUpItem.value),
);

const showTopUpModal = computed(() => !!selectedBalanceItem.value);

const selectedAutoTopUpItem = ref<ChargeOnDemandPricingItem | undefined>();

const showAutoTopUpModal = computed(() => !!selectedAutoTopUpItem.value);

const autoTopUpWallet = computed(() =>
    getWalletBalanceForTopUpItem(props.walletBalances, selectedAutoTopUpItem.value),
);

const cancellingAutoTopUpConfig = ref<WalletAutoTopUpConfig | undefined>();

const showAutoTopUpCancellation = computed(() => !!cancellingAutoTopUpConfig.value);
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
        show-auto-top-up
        show-manual-top-up
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
        @top-up="selectedTopUpItem = $event"
        @auto-top-up="selectedAutoTopUpItem = $event"
        @cancel-auto-top-up="cancellingAutoTopUpConfig = $event"
    />

    <TopUpModal
        v-if="showTopUpButton"
        :show-modal="showTopUpModal"
        :selected-balance-item="selectedBalanceItem"
        :payment-methods="paymentMethods"
        :customer="customer"
        :subscriptions="subscriptions"
        @close="selectedTopUpItem = undefined"
        @confirm="emit('top-up-charged')"
        @payment-success="emit('payment-method-stored')"
        @payment-failed="(error) => emit('payment-failed', error)"
    />

    <AutoTopUpModal
        v-if="showTopUpButton"
        :show-modal="showAutoTopUpModal"
        :wallet-balance-item="autoTopUpWallet"
        :top-up-item="selectedAutoTopUpItem"
        :payment-methods="paymentMethods"
        :customer="customer"
        @close="selectedAutoTopUpItem = undefined"
        @saved="emit('auto-top-up-saved')"
        @payment-success="emit('payment-method-stored')"
        @payment-failed="(error) => emit('payment-failed', error)"
    />

    <AutoTopUpCancellationModal
        v-if="showTopUpButton"
        :show-modal="showAutoTopUpCancellation"
        :config="cancellingAutoTopUpConfig"
        @close="cancellingAutoTopUpConfig = undefined"
        @confirmed="emit('auto-top-up-cancelled')"
    />
</template>
