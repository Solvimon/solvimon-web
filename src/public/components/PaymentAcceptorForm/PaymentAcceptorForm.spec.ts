import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import PaymentAcceptorForm from './PaymentAcceptorForm.vue';
import { ApiError } from '@/services/apiError';

const { mockSubmit, mockDispatch, mockLoggerError } = vi.hoisted(() => ({
    mockSubmit: vi.fn(),
    mockDispatch: vi.fn(),
    mockLoggerError: vi.fn(),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLoggerError }),
}));

vi.mock('@/components/providers/HostElementProvider/composables/useHostEvent', () => ({
    useHostEvent: () => ({
        dispatch: mockDispatch,
        componentName: 'solvimon-payment-acceptor-form',
    }),
}));

// Validates and builds the payload itself; its own spec covers that.
vi.mock('@/components/payments/PaymentAcceptorForm/PaymentAcceptorForm.vue', () => ({
    default: defineComponent({
        name: 'InternalPaymentAcceptorForm',
        props: { paymentAcceptor: Object, disabled: Boolean, apiError: Object },
        setup(_, { expose }) {
            expose({ submit: mockSubmit });
            return () => h('div', { class: 'internal-form-stub' });
        },
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup: (props) => () => h('div', { class: 'error-notification-stub' }, props.title),
        }),
    });
});

const stored = { id: 'paya_1', name: 'Main', status: 'ACTIVE' } as unknown as PaymentAcceptor;

const mountForm = (props: Record<string, unknown> = {}) =>
    mount(PaymentAcceptorForm, {
        props: {
            actions: {
                create: vi.fn().mockResolvedValue({ ...stored, id: 'paya_new' }),
                update: vi.fn().mockResolvedValue(stored),
            },
            ...props,
        },
    });

describe('PaymentAcceptorForm (public)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('adds a bank account and tells the host', async () => {
        mockSubmit.mockResolvedValue({ method: 'CREATE', details: { name: 'Main' } });
        const wrapper = mountForm();

        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(wrapper.props('actions').create).toHaveBeenCalledWith({ name: 'Main' });
        expect(mockDispatch).toHaveBeenCalledWith('solvimon-payment-acceptor-saved', {
            componentName: 'solvimon-payment-acceptor-form',
            paymentAcceptorId: 'paya_new',
        });
    });

    it('edits the bank account it was opened with', async () => {
        mockSubmit.mockResolvedValue({ method: 'UPDATE', payload: { name: 'Renamed' } });
        const wrapper = mountForm({ paymentAcceptor: stored });

        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(wrapper.props('actions').update).toHaveBeenCalledWith(stored, { name: 'Renamed' });
    });

    it('saves nothing while the form is incomplete', async () => {
        mockSubmit.mockResolvedValue(undefined);
        const wrapper = mountForm();

        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(wrapper.props('actions').create).not.toHaveBeenCalled();
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('shows a refused field at the field', async () => {
        mockSubmit.mockResolvedValue({ method: 'CREATE', details: { name: 'Main' } });
        const wrapper = mountForm({
            actions: {
                create: vi
                    .fn()
                    .mockRejectedValue(
                        new ApiError({ statusCode: 400, field: 'iban', message: 'Bad IBAN' }),
                    ),
                update: vi.fn(),
            },
        });

        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(
            wrapper.findComponent({ name: 'InternalPaymentAcceptorForm' }).props('apiError'),
        ).toEqual({ iban: 'Bad IBAN' });
        expect(wrapper.find('.error-notification-stub').exists()).toBe(false);
    });

    it('says something went wrong when the save fails otherwise', async () => {
        mockSubmit.mockResolvedValue({ method: 'CREATE', details: { name: 'Main' } });
        const wrapper = mountForm({
            actions: { create: vi.fn().mockRejectedValue(new Error('down')), update: vi.fn() },
        });

        await wrapper.find('form').trigger('submit');
        await flushPromises();

        expect(wrapper.find('.error-notification-stub').exists()).toBe(true);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'PAYMENT_ACCEPTOR_SAVE_FAILED',
            expect.any(String),
            {},
            expect.any(Error),
        );
    });

    it('says the bank account to edit is missing', () => {
        const wrapper = mountForm({ isPaymentAcceptorMissing: true });

        expect(wrapper.text()).toContain('We could not find this payment acceptor.');
        expect(wrapper.find('form').exists()).toBe(false);
    });
});
