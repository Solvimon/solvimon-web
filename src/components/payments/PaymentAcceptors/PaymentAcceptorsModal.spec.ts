import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import PaymentAcceptorsModal from './PaymentAcceptorsModal.vue';
import type {
    PaymentAcceptorsModalProps,
    PaymentAcceptorsModalStart,
} from './PaymentAcceptorsModal.types';
import { ApiError } from '@/services/apiError';

const { mockSubmit, mockLoggerError } = vi.hoisted(() => ({
    mockSubmit: vi.fn(),
    mockLoggerError: vi.fn(),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLoggerError }),
}));

// Validates and builds the payload itself; its own spec covers that.
vi.mock('@/components/payments/PaymentAcceptorForm/PaymentAcceptorForm.vue', () => ({
    default: defineComponent({
        name: 'PaymentAcceptorForm',
        props: { paymentAcceptor: Object, disabled: Boolean, apiError: Object },
        setup(_, { expose }) {
            expose({ submit: mockSubmit });
            return () => h('div', { class: 'payment-acceptor-form-stub' });
        },
    }),
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        Modal: defineComponent({
            name: 'ModalStub',
            props: {
                showModal: Boolean,
                title: String,
                confirmButtonText: String,
                cancelButtonText: String,
                isLoading: Boolean,
            },
            emits: ['confirm', 'close'],
            setup:
                (props, { slots, emit }) =>
                () =>
                    props.showModal
                        ? h('div', { class: 'modal' }, [
                              h('h1', { class: 'modal__title' }, props.title),
                              h('div', { class: 'modal__body' }, slots.body?.()),
                              ...(slots.footer
                                  ? [h('div', { class: 'modal__footer' }, slots.footer())]
                                  : [
                                        h(
                                            'button',
                                            {
                                                class: 'modal__confirm',
                                                onClick: () => emit('confirm'),
                                            },
                                            props.confirmButtonText ?? 'Confirm',
                                        ),
                                        h(
                                            'button',
                                            {
                                                class: 'modal__cancel',
                                                onClick: () => emit('close'),
                                            },
                                            props.cancelButtonText,
                                        ),
                                    ]),
                          ])
                        : null,
        }),
        PaymentAcceptor: defineComponent({
            name: 'PaymentAcceptorStub',
            props: { paymentAcceptor: Object, options: Array },
            setup: (props) => () =>
                h('div', { class: 'payment-acceptor-stub' }, [
                    (props.paymentAcceptor as PaymentAcceptor).name,
                    ...((props.options ?? []) as { label: string; onClick: () => void }[]).map(
                        (item) =>
                            h(
                                'button',
                                {
                                    class: 'payment-acceptor-stub__menu-item',
                                    onClick: item.onClick,
                                },
                                item.label,
                            ),
                    ),
                ]),
        }),
        CheckboxGroupExtended: defineComponent({
            name: 'CheckboxGroupExtendedStub',
            props: { modelValue: Array, options: Array },
            emits: ['update:modelValue'],
            setup: () => () => h('div', { class: 'checkbox-group-stub' }),
        }),
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup: (props) => () => h('div', { class: 'error-notification-stub' }, props.title),
        }),
    });
});

const acceptor = (id: string, status: PaymentAcceptor['status'] = 'ACTIVE') =>
    ({
        id,
        name: `${id} account`,
        status,
        reference: id,
        object_type: 'PAYMENT_ACCEPTOR',
        type: 'BANK_ACCOUNT',
        bank_account: { type: 'IBAN', iban: `NL00${id}` },
    }) as unknown as PaymentAcceptor;

const mountComponent = (props: Partial<PaymentAcceptorsModalProps> = {}) =>
    mount(PaymentAcceptorsModal, {
        props: {
            showModal: true,
            paymentAcceptors: [acceptor('main'), acceptor('old', 'ARCHIVED')],
            actions: {
                create: vi.fn().mockResolvedValue(acceptor('new')),
                update: vi.fn().mockResolvedValue(acceptor('main')),
                remove: vi.fn().mockResolvedValue(undefined),
            },
            ...props,
        },
    });

const start = (value: PaymentAcceptorsModalStart) => ({ start: value });

describe('PaymentAcceptorsModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmit.mockResolvedValue({
            method: 'CREATE',
            details: { name: 'New account', type: 'BANK_ACCOUNT' },
        });
    });

    it('lists every acceptor, inactive ones too', () => {
        const wrapper = mountComponent();

        expect(wrapper.findAll('.payment-acceptor-stub')).toHaveLength(2);
    });

    it('adds an acceptor from the list and goes back to it', async () => {
        const wrapper = mountComponent();

        await wrapper.find('.sv-payment-acceptors-modal__add').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.props('actions').create).toHaveBeenCalledWith({
            name: 'New account',
            type: 'BANK_ACCOUNT',
        });
        expect(wrapper.find('.modal__title').text()).toBe('Payment acceptors');
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('closes after adding when it was opened to add', async () => {
        const wrapper = mountComponent(start({ step: 'ADD' }));

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('stores nothing while the form is incomplete', async () => {
        mockSubmit.mockResolvedValue(undefined);
        const wrapper = mountComponent(start({ step: 'ADD' }));

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.props('actions').create).not.toHaveBeenCalled();
    });

    it('hands a refused field to the form rather than a general error', async () => {
        const create = vi
            .fn()
            .mockRejectedValue(
                new ApiError({ statusCode: 400, field: 'iban', message: 'Bad IBAN' }),
            );
        const wrapper = mountComponent({
            ...start({ step: 'ADD' }),
            actions: { create, update: vi.fn(), remove: vi.fn() },
        });

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.findComponent({ name: 'PaymentAcceptorForm' }).props('apiError')).toEqual({
            iban: 'Bad IBAN',
        });
        expect(wrapper.find('.error-notification-stub').exists()).toBe(false);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'PAYMENT_ACCEPTOR_SAVE_FAILED',
            expect.any(String),
            {},
            expect.any(ApiError),
        );
    });

    it('says something went wrong when the save fails without a field', async () => {
        const create = vi.fn().mockRejectedValue(new Error('down'));
        const wrapper = mountComponent({
            ...start({ step: 'ADD' }),
            actions: { create, update: vi.fn(), remove: vi.fn() },
        });

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.find('.error-notification-stub').exists()).toBe(true);
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('edits an acceptor from its menu with the changes the form hands back', async () => {
        mockSubmit.mockResolvedValue({
            method: 'UPDATE',
            payload: { type: 'BANK_ACCOUNT', name: 'Renamed' },
        });
        const wrapper = mountComponent();

        await wrapper.find('.payment-acceptor-stub__menu-item').trigger('click');
        expect(
            wrapper.findComponent({ name: 'PaymentAcceptorForm' }).props('paymentAcceptor'),
        ).toMatchObject({ id: 'main' });

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.props('actions').update).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'main' }),
            { type: 'BANK_ACCOUNT', name: 'Renamed' },
        );
    });

    it('deletes an acceptor once confirmed', async () => {
        const wrapper = mountComponent(
            start({ step: 'DELETE', paymentAcceptor: acceptor('main') }),
        );

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.props('actions').remove).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'main' }),
        );
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    describe('choosing for a subscription', () => {
        const subscription = { id: 'ppsu_1', paymentAcceptorIds: ['main'], payerName: 'Tivoli' };

        it('offers only the active acceptors, with the linked ones ticked', () => {
            const wrapper = mountComponent({ ...start({ step: 'CHOOSE' }), subscription });

            const choices = wrapper.findComponent({ name: 'CheckboxGroupExtendedStub' });
            expect(
                (choices.props('options') as { value: string }[]).map(({ value }) => value),
            ).toEqual(['main']);
            expect(choices.props('modelValue')).toEqual(['main']);
        });

        it('explains that every active acceptor applies while none is chosen', () => {
            const wrapper = mountComponent({
                ...start({ step: 'CHOOSE' }),
                subscription: { ...subscription, paymentAcceptorIds: [] },
            });

            expect(wrapper.text()).toContain(
                'No specific accounts are chosen for this subscription, so Tivoli can pay you into any of your active accounts.',
            );
        });

        it('saves the chosen acceptors and closes', async () => {
            const saveChoice = vi.fn().mockResolvedValue(undefined);
            const wrapper = mountComponent({
                ...start({ step: 'CHOOSE' }),
                subscription,
                saveChoice,
            });

            await wrapper.find('.modal__confirm').trigger('click');
            await flushPromises();

            expect(saveChoice).toHaveBeenCalledWith(['main']);
            expect(wrapper.emitted('close')).toHaveLength(1);
        });

        it('goes back to choosing after adding one, with the new one ticked', async () => {
            const wrapper = mountComponent({ ...start({ step: 'CHOOSE' }), subscription });

            await wrapper.find('.sv-payment-acceptors-modal__add').trigger('click');
            await wrapper.find('.modal__confirm').trigger('click');
            await flushPromises();

            expect(wrapper.find('.modal__title').text()).toBe('Choose payment acceptors');
            expect(
                wrapper.findComponent({ name: 'CheckboxGroupExtendedStub' }).props('modelValue'),
            ).toEqual(['main', 'new']);
        });

        it('starts on adding when there is nothing to choose from', () => {
            const wrapper = mountComponent({
                ...start({ step: 'CHOOSE' }),
                paymentAcceptors: [],
                subscription: { ...subscription, paymentAcceptorIds: [] },
            });

            expect(wrapper.find('.modal__title').text()).toBe('New payment acceptor');
            expect(wrapper.find('.modal__cancel').text()).toBe('Cancel');
        });
    });
});
