import SolvimonWalletBalancesVue from './WalletBalances.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const {
    element: SolvimonWalletBalances,
    componentName: COMPONENT_NAME,
    define: defineSolvimonWalletBalances,
} = createSolvimonElement(SolvimonWalletBalancesVue, 'wallet-balances');
