import { mount } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import type { WalletAutoTopUpConfig } from '@solvimon/solvimon-types';
import AutoTopUpCancellationModal from './AutoTopUpCancellationModal.vue';

const { mockDeactivate } = vi.hoisted(() => ({ mockDeactivate: vi.fn() }));

vi.mock('@/services/autoTopUpConfigs', () => ({
    createAutoTopUpConfigsService: () => ({ deactivateAutoTopUpConfig: mockDeactivate }),
}));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            template: '<div data-testid="error">{{ title }}</div>',
        }),
        // The real one resolves solvimon-ui's own intl provider, which is not this modal's concern.
        Modal: defineComponent({
            name: 'ModalStub',
            props: [
                'showModal',
                'title',
                'confirmButtonText',
                'cancelButtonText',
                'isLoading',
                'size',
                'noClickAway',
                'noBackdropClose',
            ],
            emits: ['confirm', 'close'],
            template: `
                <div v-if="showModal">
                    <h1>{{ title }}</h1>
                    <slot name="body" />
                    <button type="button" data-testid="cancel" @click="$emit('close')">
                        {{ cancelButtonText }}
                    </button>
                    <button type="button" data-testid="confirm" @click="$emit('confirm')">
                        {{ confirmButtonText }}
                    </button>
                </div>
            `,
        }),
    });
});

const config = {
    id: 'atuc_1',
    wallet_id: 'wall_1',
    status: 'ACTIVE',
    threshold: { amount: { quantity: '5.00', currency: 'EUR' } },
    topup_amount: { quantity: '10.00', currency: 'EUR' },
} as unknown as WalletAutoTopUpConfig;

const creditConfig = {
    ...config,
    threshold: {
        credits: {
            quantity: '500',
            credit_type_id: 'ctyp_1',
            credit_type: { unit_name: { singular: 'coin', plural: 'coins' } },
        },
    },
} as unknown as WalletAutoTopUpConfig;

const mountModal = (props: Record<string, unknown> = {}) =>
    mount(AutoTopUpCancellationModal, {
        props: { showModal: true, config, ...props },
        attachTo: document.body,
    });

const confirm = async (wrapper: ReturnType<typeof mountModal>) => {
    await wrapper.find('[data-testid="confirm"]').trigger('click');
    await nextTick();
};

describe('AutoTopUpCancellationModal', () => {
    beforeEach(() => {
        mockDeactivate.mockReset();
        mockDeactivate.mockResolvedValue({ id: 'atuc_1', status: 'INACTIVE' });
    });

    it('stays shut until it is opened', () => {
        expect(mountModal({ showModal: false }).text()).toBe('');
    });

    it('says what will stop happening', () => {
        expect(mountModal().text()).toContain('10.00');
        expect(mountModal().text()).toContain('5.00');
    });

    it('states a credits threshold in credits', () => {
        expect(mountModal({ config: creditConfig }).text()).toContain('coins');
    });

    it('still explains itself for a rule with no amount of its own', () => {
        const wrapper = mountModal({ config: { ...config, topup_amount: undefined } });

        expect(wrapper.text()).toContain('5.00');
        expect(wrapper.find('[data-testid="error"]').exists()).toBe(false);
    });

    it('turns the rule off when confirmed', async () => {
        const wrapper = mountModal();

        await confirm(wrapper);

        expect(mockDeactivate).toHaveBeenCalledWith('atuc_1');
    });

    it('reports the change and closes once it is off', async () => {
        const wrapper = mountModal();

        await confirm(wrapper);

        expect(wrapper.emitted('confirmed')).toHaveLength(1);
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('stays open and says so when turning it off fails', async () => {
        mockDeactivate.mockRejectedValue(new Error('nope'));
        const wrapper = mountModal();

        await confirm(wrapper);

        expect(wrapper.emitted('confirmed')).toBeUndefined();
        expect(wrapper.emitted('close')).toBeUndefined();
        expect(wrapper.find('[data-testid="error"]').exists()).toBe(true);
    });

    it('forgets a previous failure when opened again', async () => {
        mockDeactivate.mockRejectedValue(new Error('nope'));
        const wrapper = mountModal();
        await confirm(wrapper);

        await wrapper.setProps({ showModal: false });
        await wrapper.setProps({ showModal: true });

        expect(wrapper.find('[data-testid="error"]').exists()).toBe(false);
    });

    it('closes when dismissed, without turning anything off', async () => {
        const wrapper = mountModal();

        await wrapper.find('[data-testid="cancel"]').trigger('click');

        expect(mockDeactivate).not.toHaveBeenCalled();
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('does nothing for a rule that was never saved', async () => {
        const wrapper = mountModal({ config: { ...config, id: undefined } });

        await confirm(wrapper);

        expect(mockDeactivate).not.toHaveBeenCalled();
    });
});
