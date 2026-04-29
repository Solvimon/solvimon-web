import SolvimonWalletBalancesVue from './WalletBalances.entry.vue';
import { defineCustomElement } from '@/utils/customElements';
import { getComponentName } from '@/utils/component';

export const SolvimonWalletBalances = defineCustomElement(SolvimonWalletBalancesVue);
export const COMPONENT_NAME = getComponentName('wallet-balances');

export const defineSolvimonWalletBalances = () => {
    if (!customElements.get(COMPONENT_NAME)) {
        customElements.define(COMPONENT_NAME, SolvimonWalletBalances);
    }
};
