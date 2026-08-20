import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import type { CustomerWalletBalanceItem } from '@solvimon/solvimon-types';
import CustomerWalletBalances from './CustomerWalletBalances.vue';

// Both modals build their own request services, which need providers this mount does not have. The
vi.mock('@/components/wallets/TopUpModal/TopUpModal.vue', () => ({
    default: defineComponent({
        name: 'TopUpModalStub',
        props: { showModal: Boolean, selectedBalanceItem: Object },
        emits: ['close', 'confirm', 'payment-success'],
        setup: (props) => () =>
            h('div', { class: 'top-up-modal', 'data-open': String(props.showModal) }),
    }),
}));

vi.mock('@/components/wallets/AutoTopUpModal/AutoTopUpModal.vue', () => ({
    default: defineComponent({
        name: 'AutoTopUpModalStub',
        props: { showModal: Boolean, walletBalanceItem: Object, topUpItem: Object },
        emits: ['close', 'saved', 'payment-success'],
        setup: (props) => () =>
            h('div', { class: 'auto-top-up-modal', 'data-open': String(props.showModal) }),
    }),
}));

vi.mock('@/components/wallets/AutoTopUpCancellationModal/AutoTopUpCancellationModal.vue', () => ({
    default: defineComponent({
        name: 'AutoTopUpCancellationModalStub',
        props: { showModal: Boolean, config: Object },
        emits: ['close', 'confirmed'],
        setup: (props) => () =>
            h('div', { class: 'auto-top-up-cancellation', 'data-open': String(props.showModal) }),
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        WalletBalances: defineComponent({
            name: 'WalletBalancesStub',
            props: {
                customerWalletBalances: { type: Array, required: true },
                title: String,
                showAutoTopUp: Boolean,
                showManualTopUp: Boolean,
            },
            emits: ['top-up', 'auto-top-up', 'cancel-auto-top-up'],
            setup: (props) => () =>
                h('div', { class: 'wallet-balances' }, String(props.customerWalletBalances.length)),
        }),
    });
});

const flexibleTopUp = { pricing_item_id: 'prii_flexible', pricing_plan_schedule_id: 'ppsc_1' };

const walletBalance = {
    wallet_id: 'wall_1',
    wallet_balance: { open_balance: { amount: { quantity: '25.00', currency: 'EUR' } } },
    charge_on_demand_pricing_items: [flexibleTopUp],
} as unknown as CustomerWalletBalanceItem;

const otherWallet = {
    wallet_id: 'wall_2',
    wallet_balance: { open_balance: { amount: { quantity: '10.00', currency: 'EUR' } } },
    charge_on_demand_pricing_items: [
        { pricing_item_id: 'prii_other', pricing_plan_schedule_id: 'ppsc_2' },
    ],
} as unknown as CustomerWalletBalanceItem;

const mountBlock = (props: Record<string, unknown> = {}) =>
    mount(CustomerWalletBalances, {
        props: {
            hasError: false,
            isLoading: false,
            walletBalances: [walletBalance],
            showTopUpButton: true,
            ...props,
        },
    });

const rows = (wrapper: ReturnType<typeof mountBlock>) =>
    wrapper.findComponent({ name: 'WalletBalancesStub' });

const topUpModal = (wrapper: ReturnType<typeof mountBlock>) =>
    wrapper.findComponent({ name: 'TopUpModalStub' });

const autoTopUpModal = (wrapper: ReturnType<typeof mountBlock>) =>
    wrapper.findComponent({ name: 'AutoTopUpModalStub' });

const cancellationModal = (wrapper: ReturnType<typeof mountBlock>) =>
    wrapper.findComponent({ name: 'AutoTopUpCancellationModalStub' });

describe('CustomerWalletBalances', () => {
    it('renders the balances it is given', () => {
        expect(mountBlock().find('.wallet-balances').text()).toBe('1');
    });

    it('keeps both modals closed until a wallet asks for one', () => {
        const wrapper = mountBlock();

        expect(topUpModal(wrapper).attributes('data-open')).toBe('false');
        expect(autoTopUpModal(wrapper).attributes('data-open')).toBe('false');
    });

    describe('topping up', () => {
        it('opens the top-up modal on the wallet the chosen top-up belongs to', async () => {
            const wrapper = mountBlock({ walletBalances: [otherWallet, walletBalance] });

            rows(wrapper).vm.$emit('top-up', flexibleTopUp);
            await nextTick();

            expect(topUpModal(wrapper).attributes('data-open')).toBe('true');
            expect(topUpModal(wrapper).props('selectedBalanceItem')).toMatchObject({
                wallet_id: 'wall_1',
            });
        });

        it('closes again when the modal is dismissed', async () => {
            const wrapper = mountBlock();

            rows(wrapper).vm.$emit('top-up', flexibleTopUp);
            await nextTick();
            topUpModal(wrapper).vm.$emit('close');
            await nextTick();

            expect(topUpModal(wrapper).attributes('data-open')).toBe('false');
        });

        it('reports a charged top-up so the balance can be reloaded', () => {
            const wrapper = mountBlock();

            topUpModal(wrapper).vm.$emit('confirm');

            expect(wrapper.emitted('top-up-charged')).toHaveLength(1);
        });
    });

    describe('automatic top-up', () => {
        it('opens the auto top-up modal for the top-up that asked', async () => {
            const wrapper = mountBlock();

            rows(wrapper).vm.$emit('auto-top-up', flexibleTopUp);
            await nextTick();

            expect(autoTopUpModal(wrapper).attributes('data-open')).toBe('true');
            expect(autoTopUpModal(wrapper).props('topUpItem')).toEqual(flexibleTopUp);
        });

        it('resolves the wallet the chosen top-up belongs to', async () => {
            const wrapper = mountBlock({ walletBalances: [otherWallet, walletBalance] });

            rows(wrapper).vm.$emit('auto-top-up', flexibleTopUp);
            await nextTick();

            expect(autoTopUpModal(wrapper).props('walletBalanceItem')).toMatchObject({
                wallet_id: 'wall_1',
            });
        });

        it('closes again when the modal is dismissed', async () => {
            const wrapper = mountBlock();

            rows(wrapper).vm.$emit('auto-top-up', flexibleTopUp);
            await nextTick();
            autoTopUpModal(wrapper).vm.$emit('close');
            await nextTick();

            expect(autoTopUpModal(wrapper).attributes('data-open')).toBe('false');
        });

        it('reports a saved rule so the wallet showing it can be reloaded', () => {
            const wrapper = mountBlock();

            autoTopUpModal(wrapper).vm.$emit('saved');

            expect(wrapper.emitted('auto-top-up-saved')).toHaveLength(1);
        });
    });

    describe('turning an automatic top-up off', () => {
        const activeRule = { id: 'atuc_1', status: 'ACTIVE' };

        it('asks before turning the rule off', async () => {
            const wrapper = mountBlock();

            rows(wrapper).vm.$emit('cancel-auto-top-up', activeRule);
            await nextTick();

            expect(cancellationModal(wrapper).attributes('data-open')).toBe('true');
            expect(cancellationModal(wrapper).props('config')).toEqual(activeRule);
        });

        it('keeps the question shut until a rule is picked', () => {
            expect(cancellationModal(mountBlock()).attributes('data-open')).toBe('false');
        });

        it('closes again when the question is dismissed', async () => {
            const wrapper = mountBlock();

            rows(wrapper).vm.$emit('cancel-auto-top-up', activeRule);
            await nextTick();
            cancellationModal(wrapper).vm.$emit('close');
            await nextTick();

            expect(cancellationModal(wrapper).attributes('data-open')).toBe('false');
        });

        it('reports the rule being off so the wallet showing it can be reloaded', () => {
            const wrapper = mountBlock();

            cancellationModal(wrapper).vm.$emit('confirmed');

            expect(wrapper.emitted('auto-top-up-cancelled')).toHaveLength(1);
        });
    });

    it('builds neither modal where topping up is not offered', () => {
        const wrapper = mountBlock({ showTopUpButton: false });

        expect(topUpModal(wrapper).exists()).toBe(false);
        expect(autoTopUpModal(wrapper).exists()).toBe(false);
        expect(cancellationModal(wrapper).exists()).toBe(false);
    });
});
