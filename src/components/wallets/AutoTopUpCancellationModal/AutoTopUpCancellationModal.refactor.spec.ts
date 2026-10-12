import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import type { WalletAutoTopUpConfig } from '@solvimon/solvimon-types';
import AutoTopUpCancellationModal from './AutoTopUpCancellationModal.vue';

/**
 * DD-3553 moved the call out of the modal into `useDeactivateAutoTopUpConfig`. These pin what the
 * modal does around it, so they pass against the code before and after that move.
 */

const { mockDeactivate, mockError } = vi.hoisted(() => ({
    mockDeactivate: vi.fn(),
    mockError: vi.fn(),
}));

vi.mock('@/services/autoTopUpConfigs', () => ({
    createAutoTopUpConfigsService: () => ({ deactivateAutoTopUpConfig: mockDeactivate }),
}));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ warn: vi.fn(), error: mockError }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        ErrorNotification: defineComponent({
            props: { title: String },
            template: '<div data-testid="error">{{ title }}</div>',
        }),
        Modal: defineComponent({
            props: ['showModal', 'title', 'confirmButtonText', 'cancelButtonText', 'isLoading'],
            emits: ['confirm', 'close'],
            template: `
                <div v-if="showModal" :data-loading="String(!!isLoading)">
                    <slot name="body" />
                    <button type="button" data-testid="cancel" @click="$emit('close')" />
                    <button type="button" data-testid="confirm" @click="$emit('confirm')" />
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

const mountModal = () =>
    mount(AutoTopUpCancellationModal, {
        props: { showModal: true, config },
        attachTo: document.body,
    });

describe('AutoTopUpCancellationModal around the deactivation call', () => {
    beforeEach(() => {
        mockDeactivate.mockReset();
        mockError.mockReset();
    });

    it('closes on success, and logs nothing', async () => {
        mockDeactivate.mockResolvedValue({ id: 'atuc_1', status: 'INACTIVE' });
        const wrapper = mountModal();

        await wrapper.find('[data-testid="confirm"]').trigger('click');
        await flushPromises();

        expect(wrapper.emitted('confirmed')).toHaveLength(1);
        expect(wrapper.emitted('close')).toHaveLength(1);
        expect(wrapper.find('[data-testid="error"]').exists()).toBe(false);
        expect(mockError).not.toHaveBeenCalled();
    });

    it('stays open, shows the error and logs AUTO_TOP_UP_CANCELLATION_FAILED exactly once', async () => {
        const failure = new Error('nope');
        mockDeactivate.mockRejectedValue(failure);
        const wrapper = mountModal();

        await wrapper.find('[data-testid="confirm"]').trigger('click');
        await flushPromises();

        expect(wrapper.emitted('confirmed')).toBeUndefined();
        expect(wrapper.emitted('close')).toBeUndefined();
        expect(wrapper.find('[data-testid="error"]').exists()).toBe(true);
        expect(mockError).toHaveBeenCalledTimes(1);
        expect(mockError).toHaveBeenCalledWith(
            'AUTO_TOP_UP_CANCELLATION_FAILED',
            "Failed to turn off a wallet's automatic top-up",
            {},
            failure,
        );
        expect(wrapper.find('[data-loading]').attributes('data-loading')).toBe('false');
    });

    it('shows loading, ignores a second confirm and refuses to close while the call is out', async () => {
        let settle: (value: unknown) => void = () => {};
        mockDeactivate.mockReturnValue(new Promise((resolve) => (settle = resolve)));
        const wrapper = mountModal();

        await wrapper.find('[data-testid="confirm"]').trigger('click');
        await wrapper.find('[data-testid="confirm"]').trigger('click');
        await wrapper.find('[data-testid="cancel"]').trigger('click');

        expect(wrapper.find('[data-loading]').attributes('data-loading')).toBe('true');
        expect(mockDeactivate).toHaveBeenCalledTimes(1);
        expect(wrapper.emitted('close')).toBeUndefined();

        settle({ id: 'atuc_1', status: 'INACTIVE' });
        await flushPromises();

        expect(wrapper.emitted('confirmed')).toHaveLength(1);
        expect(wrapper.emitted('close')).toHaveLength(1);
        expect(wrapper.find('[data-loading]').attributes('data-loading')).toBe('false');
    });

    it('clears an earlier failure when confirmed again, and succeeds', async () => {
        mockDeactivate.mockRejectedValueOnce(new Error('nope'));
        mockDeactivate.mockResolvedValueOnce({ id: 'atuc_1', status: 'INACTIVE' });
        const wrapper = mountModal();

        await wrapper.find('[data-testid="confirm"]').trigger('click');
        await flushPromises();
        expect(wrapper.find('[data-testid="error"]').exists()).toBe(true);

        await wrapper.find('[data-testid="confirm"]').trigger('click');
        await flushPromises();

        expect(mockError).toHaveBeenCalledTimes(1);
        expect(wrapper.emitted('confirmed')).toHaveLength(1);
    });
});
