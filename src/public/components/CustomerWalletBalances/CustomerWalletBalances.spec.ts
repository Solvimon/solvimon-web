import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { CustomerWalletBalanceItem } from '@solvimon/solvimon-types';
import CustomerWalletBalances from './CustomerWalletBalances.vue';

// The modals build their own request services, which need providers this mount does not have.
vi.mock('@/components/wallets/TopUpModal/TopUpModal.vue', () => ({
    __esModule: true,
    default: defineComponent({
        name: 'TopUpModalStub',
        props: { showModal: Boolean, selectedBalanceItem: Object },
        emits: ['close', 'confirm', 'auto-top-up-saved', 'payment-success'],
        setup: (props) => () =>
            h('div', { class: 'top-up-modal', 'data-open': String(props.showModal) }),
    }),
}));

vi.mock('@/components/wallets/AutoTopUpModal/AutoTopUpModal.vue', () => ({
    __esModule: true,
    default: defineComponent({
        name: 'AutoTopUpModalStub',
        props: { showModal: Boolean, walletBalanceItem: Object, topUpItem: Object },
        emits: ['close', 'saved', 'payment-success'],
        setup: (props) => () =>
            h('div', { class: 'auto-top-up-modal', 'data-open': String(props.showModal) }),
    }),
}));

vi.mock('@/components/wallets/AutoTopUpCancellationModal/AutoTopUpCancellationModal.vue', () => ({
    __esModule: true,
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

const openWith = async (
    wrapper: ReturnType<typeof mountBlock>,
    event: 'top-up' | 'auto-top-up' | 'cancel-auto-top-up',
    payload: unknown,
) => {
    rows(wrapper).vm.$emit(event, payload);
    await flushPromises();
};

describe('CustomerWalletBalances', () => {
    it('renders the balances it is given', () => {
        expect(mountBlock().find('.wallet-balances').text()).toBe('1');
    });

    // Each modal is its own chunk, so a page that never opens one never downloads it.
    it('mounts no modal until a wallet asks for one', async () => {
        const wrapper = mountBlock();
        await flushPromises();

        expect(topUpModal(wrapper).exists()).toBe(false);
        expect(autoTopUpModal(wrapper).exists()).toBe(false);
        expect(cancellationModal(wrapper).exists()).toBe(false);
    });

    it('mounts only the modal a wallet asks for', async () => {
        const wrapper = mountBlock();

        await openWith(wrapper, 'top-up', flexibleTopUp);

        expect(topUpModal(wrapper).exists()).toBe(true);
        expect(autoTopUpModal(wrapper).exists()).toBe(false);
        expect(cancellationModal(wrapper).exists()).toBe(false);
    });

    describe('topping up', () => {
        it('opens the top-up modal on the wallet the chosen top-up belongs to', async () => {
            const wrapper = mountBlock({ walletBalances: [otherWallet, walletBalance] });

            await openWith(wrapper, 'top-up', flexibleTopUp);

            expect(topUpModal(wrapper).attributes('data-open')).toBe('true');
            expect(topUpModal(wrapper).props('selectedBalanceItem')).toMatchObject({
                wallet_id: 'wall_1',
            });
        });

        it('closes again when the modal is dismissed', async () => {
            const wrapper = mountBlock();

            await openWith(wrapper, 'top-up', flexibleTopUp);
            topUpModal(wrapper).vm.$emit('close');
            await flushPromises();

            expect(topUpModal(wrapper).attributes('data-open')).toBe('false');
        });

        it('reports a charged top-up so the balance can be reloaded', async () => {
            const wrapper = mountBlock();
            await openWith(wrapper, 'top-up', flexibleTopUp);

            topUpModal(wrapper).vm.$emit('confirm');

            expect(wrapper.emitted('top-up-charged')).toHaveLength(1);
        });

        it('reports a rule saved alongside the top-up so the wallet can be reloaded', async () => {
            const wrapper = mountBlock();
            await openWith(wrapper, 'top-up', flexibleTopUp);

            topUpModal(wrapper).vm.$emit('auto-top-up-saved');

            expect(wrapper.emitted('auto-top-up-saved')).toHaveLength(1);
        });
    });

    describe('automatic top-up', () => {
        it('opens the auto top-up modal for the top-up that asked', async () => {
            const wrapper = mountBlock();

            await openWith(wrapper, 'auto-top-up', flexibleTopUp);

            expect(autoTopUpModal(wrapper).attributes('data-open')).toBe('true');
            expect(autoTopUpModal(wrapper).props('topUpItem')).toEqual(flexibleTopUp);
        });

        it('resolves the wallet the chosen top-up belongs to', async () => {
            const wrapper = mountBlock({ walletBalances: [otherWallet, walletBalance] });

            await openWith(wrapper, 'auto-top-up', flexibleTopUp);

            expect(autoTopUpModal(wrapper).props('walletBalanceItem')).toMatchObject({
                wallet_id: 'wall_1',
            });
        });

        it('closes again when the modal is dismissed', async () => {
            const wrapper = mountBlock();

            await openWith(wrapper, 'auto-top-up', flexibleTopUp);
            autoTopUpModal(wrapper).vm.$emit('close');
            await flushPromises();

            expect(autoTopUpModal(wrapper).attributes('data-open')).toBe('false');
        });

        it('reports a saved rule so the wallet showing it can be reloaded', async () => {
            const wrapper = mountBlock();
            await openWith(wrapper, 'auto-top-up', flexibleTopUp);

            autoTopUpModal(wrapper).vm.$emit('saved');

            expect(wrapper.emitted('auto-top-up-saved')).toHaveLength(1);
        });
    });

    describe('turning an automatic top-up off', () => {
        const activeRule = { id: 'atuc_1', status: 'ACTIVE' };

        it('asks before turning the rule off', async () => {
            const wrapper = mountBlock();

            await openWith(wrapper, 'cancel-auto-top-up', activeRule);

            expect(cancellationModal(wrapper).attributes('data-open')).toBe('true');
            expect(cancellationModal(wrapper).props('config')).toEqual(activeRule);
        });

        it('closes again when the question is dismissed', async () => {
            const wrapper = mountBlock();

            await openWith(wrapper, 'cancel-auto-top-up', activeRule);
            cancellationModal(wrapper).vm.$emit('close');
            await flushPromises();

            expect(cancellationModal(wrapper).attributes('data-open')).toBe('false');
        });

        it('reports the rule being off so the wallet showing it can be reloaded', async () => {
            const wrapper = mountBlock();
            await openWith(wrapper, 'cancel-auto-top-up', activeRule);

            cancellationModal(wrapper).vm.$emit('confirmed');

            expect(wrapper.emitted('auto-top-up-cancelled')).toHaveLength(1);
        });
    });

    it('offers the top-up buttons where topping up is offered', () => {
        expect(rows(mountBlock()).props()).toMatchObject({
            showManualTopUp: true,
            showAutoTopUp: true,
        });
    });

    // Without the modals behind them, the buttons would do nothing.
    it('offers no top-up buttons where topping up is not offered', () => {
        expect(rows(mountBlock({ showTopUpButton: false })).props()).toMatchObject({
            showManualTopUp: false,
            showAutoTopUp: false,
        });
    });

    it('offers only the top-ups billed on the subscriptions it is handed', () => {
        const wrapper = mountBlock({
            walletBalances: [walletBalance, otherWallet],
            subscriptions: [{ id: 'ppsu_1', pricing_plan_schedule_infos: [{ id: 'ppsc_1' }] }],
        });

        const offered = (
            rows(wrapper).props('customerWalletBalances') as CustomerWalletBalanceItem[]
        ).map(({ charge_on_demand_pricing_items }) => charge_on_demand_pricing_items);

        expect(offered).toEqual([[flexibleTopUp], []]);
    });

    it('builds no modal where topping up is not offered', async () => {
        const wrapper = mountBlock({ showTopUpButton: false });
        await openWith(wrapper, 'top-up', flexibleTopUp);

        expect(topUpModal(wrapper).exists()).toBe(false);
        expect(autoTopUpModal(wrapper).exists()).toBe(false);
        expect(cancellationModal(wrapper).exists()).toBe(false);
    });
});
