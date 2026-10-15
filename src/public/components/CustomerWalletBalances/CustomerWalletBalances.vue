<script setup lang="ts">
import { ErrorNotification, useIntl, WalletBalances } from '@solvimon/solvimon-ui';
import type { ChargeOnDemandPricingItem, WalletAutoTopUpConfig } from '@solvimon/solvimon-types';
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type {
    CustomerWalletBalancesEmits,
    CustomerWalletBalancesProps,
} from './CustomerWalletBalances.types';
import {
    getWalletBalanceForTopUpItem,
    getWalletBalancesForSubscriptions,
} from './CustomerWalletBalances.lib';
import Skeleton from '@/components/shared/Skeleton.vue';

const loadTopUpModal = () => import('@/components/wallets/TopUpModal/TopUpModal.vue');
const loadAutoTopUpModal = () => import('@/components/wallets/AutoTopUpModal/AutoTopUpModal.vue');
const loadAutoTopUpCancellationModal = () =>
    import('@/components/wallets/AutoTopUpCancellationModal/AutoTopUpCancellationModal.vue');

const TopUpModal = defineAsyncComponent(loadTopUpModal);
const AutoTopUpModal = defineAsyncComponent(loadAutoTopUpModal);
const AutoTopUpCancellationModal = defineAsyncComponent(loadAutoTopUpCancellationModal);

defineOptions({ inheritAttrs: false });

const props = defineProps<CustomerWalletBalancesProps>();
const emit = defineEmits<CustomerWalletBalancesEmits>();

const { $t } = useIntl();

// Kept mounted after the first open so closing still plays the modal's transition.
const openedOnce = (isOpen: Ref<boolean>): Ref<boolean> => {
    const opened = ref(isOpen.value);
    watch(isOpen, (open) => {
        if (open) {
            opened.value = true;
        }
    });
    return opened;
};

// Fetched once the page is idle, so opening a modal does not wait on its download.
let cancelPrefetch: (() => void) | undefined;

watch(
    () => props.showTopUpButton,
    (show) => {
        if (!show || cancelPrefetch) {
            return;
        }

        const prefetch = () => {
            for (const load of [
                loadTopUpModal,
                loadAutoTopUpModal,
                loadAutoTopUpCancellationModal,
            ]) {
                // Opening the modal loads it again and reports a failure there.
                load().catch(() => undefined);
            }
        };

        if (typeof requestIdleCallback === 'function') {
            const id = requestIdleCallback(prefetch, { timeout: 2000 });
            cancelPrefetch = () => cancelIdleCallback(id);
        } else {
            const id = setTimeout(prefetch, 1000);
            cancelPrefetch = () => clearTimeout(id);
        }
    },
    { immediate: true },
);

onBeforeUnmount(() => cancelPrefetch?.());

const shownWalletBalances = computed(() =>
    getWalletBalancesForSubscriptions(props.walletBalances, props.subscriptions),
);

const selectedTopUpItem = ref<ChargeOnDemandPricingItem | undefined>();

const selectedBalanceItem = computed(() =>
    getWalletBalanceForTopUpItem(shownWalletBalances.value, selectedTopUpItem.value),
);

const showTopUpModal = computed(() => !!selectedBalanceItem.value);
const hasOpenedTopUp = openedOnce(showTopUpModal);

const selectedAutoTopUpItem = ref<ChargeOnDemandPricingItem | undefined>();

const showAutoTopUpModal = computed(() => !!selectedAutoTopUpItem.value);
const hasOpenedAutoTopUp = openedOnce(showAutoTopUpModal);

const autoTopUpWallet = computed(() =>
    getWalletBalanceForTopUpItem(shownWalletBalances.value, selectedAutoTopUpItem.value),
);

const cancellingAutoTopUpConfig = ref<WalletAutoTopUpConfig | undefined>();

const showAutoTopUpCancellation = computed(() => !!cancellingAutoTopUpConfig.value);
const hasOpenedAutoTopUpCancellation = openedOnce(showAutoTopUpCancellation);
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
        :customer-wallet-balances="shownWalletBalances"
        :show-auto-top-up="showTopUpButton"
        :show-manual-top-up="showTopUpButton"
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
        v-if="showTopUpButton && hasOpenedTopUp"
        :show-modal="showTopUpModal"
        :selected-balance-item="selectedBalanceItem"
        :payment-methods="paymentMethods"
        :customer="customer"
        :subscriptions="subscriptions"
        @close="selectedTopUpItem = undefined"
        @confirm="emit('top-up-charged')"
        @auto-top-up-saved="emit('auto-top-up-saved')"
        @payment-success="emit('payment-method-stored')"
        @payment-failed="(error) => emit('payment-failed', error)"
    />

    <AutoTopUpModal
        v-if="showTopUpButton && hasOpenedAutoTopUp"
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
        v-if="showTopUpButton && hasOpenedAutoTopUpCancellation"
        :show-modal="showAutoTopUpCancellation"
        :config="cancellingAutoTopUpConfig"
        @close="cancellingAutoTopUpConfig = undefined"
        @confirmed="emit('auto-top-up-cancelled')"
    />
</template>
