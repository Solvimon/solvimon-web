import type { CustomerWalletBalanceItem } from '@solvimon/solvimon-types';
import { computed, type Ref } from 'vue';

export function useTopUpModal(selectedBalance: Ref<CustomerWalletBalanceItem | undefined>) {
    const showModal = computed(() => !!selectedBalance.value);

    return { showModal };
}
