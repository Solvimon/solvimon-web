import SolvimonWalletBalancesVue from './WalletBalances.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonWalletBalances } = createSolvimonElement(
    SolvimonWalletBalancesVue,
    'wallet-balances',
);
