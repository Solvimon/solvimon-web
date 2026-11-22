import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import PaymentAcceptorsManageModal from './PaymentAcceptorsManageModal.vue';
import type { PaymentAcceptorsManageModalProps } from './PaymentAcceptorsManageModal.types';
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
                subTitle: String,
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
                                            props.confirmButtonText,
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
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup: (props) => () => h('div', { class: 'error-notification-stub' }, props.title),
        }),
    });
});

const acceptor = (id: string) =>
    ({
        id,
        name: `${id} account`,
        status: 'ACTIVE',
        reference: id,
        object_type: 'PAYMENT_ACCEPTOR',
        type: 'BANK_ACCOUNT',
        bank_account: { type: 'IBAN', iban: `NL00${id}` },
    }) as unknown as PaymentAcceptor;

const createActions = () => ({
    create: vi.fn().mockResolvedValue(acceptor('new')),
    update: vi.fn().mockResolvedValue(acceptor('main')),
    remove: vi.fn().mockResolvedValue(undefined),
});

const mountComponent = (props: Partial<PaymentAcceptorsManageModalProps> = {}) =>
    mount(PaymentAcceptorsManageModal, {
        props: {
            showModal: true,
            paymentAcceptors: [acceptor('main')],
            actions: createActions(),
            ...props,
        },
    });

const clickMenuItem = async (wrapper: ReturnType<typeof mountComponent>, label: string) => {
    const item = wrapper
        .findAll('.payment-acceptor-stub__menu-item')
        .find((button) => button.text() === label);
    await item?.trigger('click');
};

const title = (wrapper: ReturnType<typeof mountComponent>) => wrapper.find('.modal__title').text();

describe('PaymentAcceptorsManageModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmit.mockResolvedValue({
            method: 'CREATE',
            details: { name: 'New account', type: 'BANK_ACCOUNT' },
        });
    });

    it('lists the payment acceptors with their menus and closes with one button', async () => {
        const wrapper = mountComponent();

        expect(title(wrapper)).toBe('Payment acceptors');
        expect(wrapper.find('.payment-acceptor-stub').text()).toContain('main account');
        expect(wrapper.find('.modal__confirm').exists()).toBe(false);

        await wrapper.find('.sv-payment-acceptors-manage-modal__close').trigger('click');

        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('offers no edit for a payment acceptor the API will not change', () => {
        const archived = { ...acceptor('old'), status: 'ARCHIVED' } as PaymentAcceptor;
        const wrapper = mountComponent({ paymentAcceptors: [archived] });

        expect(
            wrapper.findAll('.payment-acceptor-stub__menu-item').map((item) => item.text()),
        ).toEqual(['Delete']);
    });

    it('says so when there are no payment acceptors yet', () => {
        const wrapper = mountComponent({ paymentAcceptors: [] });

        expect(wrapper.text()).toContain('You have no payment acceptors yet.');
    });

    it('adds one and goes back to the list', async () => {
        const actions = createActions();
        const wrapper = mountComponent({ actions });

        await wrapper.find('.sv-payment-acceptors-manage-modal__add').trigger('click');
        expect(title(wrapper)).toBe('New payment acceptor');
        expect(wrapper.findComponent({ name: 'ModalStub' }).props('subTitle')).toBe(
            'Subscriptions that use all payment acceptors will use this one too.',
        );
        expect(wrapper.find('.modal__confirm').text()).toBe('Create');
        expect(wrapper.find('.modal__cancel').text()).toBe('Back');

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(actions.create).toHaveBeenCalledWith({ name: 'New account', type: 'BANK_ACCOUNT' });
        expect(title(wrapper)).toBe('Payment acceptors');
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('closes after adding one when it was opened for adding', async () => {
        const wrapper = mountComponent({ start: 'ADD' });

        expect(wrapper.find('.modal__cancel').text()).toBe('Cancel');

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('edits one from its menu and goes back to the list', async () => {
        mockSubmit.mockResolvedValue({ method: 'UPDATE', payload: { name: 'Renamed' } });
        const actions = createActions();
        const wrapper = mountComponent({ actions });

        await clickMenuItem(wrapper, 'Edit');
        expect(title(wrapper)).toBe('Edit payment acceptor');
        expect(
            wrapper.findComponent({ name: 'PaymentAcceptorForm' }).props('paymentAcceptor'),
        ).toMatchObject({ id: 'main' });

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(actions.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'main' }), {
            name: 'Renamed',
        });
        expect(title(wrapper)).toBe('Payment acceptors');
    });

    it('deletes one after confirming', async () => {
        const actions = createActions();
        const wrapper = mountComponent({ actions });

        await clickMenuItem(wrapper, 'Delete');
        expect(title(wrapper)).toBe('Delete payment acceptor');

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(actions.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'main' }));
        expect(title(wrapper)).toBe('Payment acceptors');
    });

    it('stays on the step and says so when a delete fails', async () => {
        const actions = {
            ...createActions(),
            remove: vi.fn().mockRejectedValue(new Error('down')),
        };
        const wrapper = mountComponent({ actions });

        await clickMenuItem(wrapper, 'Delete');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(title(wrapper)).toBe('Delete payment acceptor');
        expect(wrapper.find('.error-notification-stub').exists()).toBe(true);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'PAYMENT_ACCEPTOR_DELETE_FAILED',
            expect.any(String),
            {},
            expect.any(Error),
        );
    });

    it('says a payment acceptor in use cannot be deleted', async () => {
        const actions = {
            ...createActions(),
            remove: vi.fn().mockRejectedValue(
                new ApiError({
                    statusCode: 400,
                    field: 'id',
                    message: 'associated with invoices',
                }),
            ),
        };
        const wrapper = mountComponent({ actions });

        await clickMenuItem(wrapper, 'Delete');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.find('.error-notification-stub').text()).toBe(
            "You can't delete this payment acceptor because a subscription or invoice uses it.",
        );
    });

    it('gives a general error for a refused field the form does not show', async () => {
        const actions = {
            ...createActions(),
            create: vi
                .fn()
                .mockRejectedValue(
                    new ApiError({ statusCode: 400, field: 'customer_id', message: 'Unknown' }),
                ),
        };
        const wrapper = mountComponent({ actions, start: 'ADD' });

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.find('.error-notification-stub').text()).toBe(
            'Something went wrong. Please try again.',
        );
        expect(
            wrapper.findComponent({ name: 'PaymentAcceptorForm' }).props('apiError'),
        ).toBeUndefined();
    });

    it('hands a refused field to the form rather than a general error', async () => {
        const actions = {
            ...createActions(),
            create: vi
                .fn()
                .mockRejectedValue(
                    new ApiError({ statusCode: 400, field: 'iban', message: 'Bad IBAN' }),
                ),
        };
        const wrapper = mountComponent({ actions, start: 'ADD' });

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.findComponent({ name: 'PaymentAcceptorForm' }).props('apiError')).toEqual({
            iban: "This value isn't accepted. Check it and try again.",
        });
        expect(wrapper.find('.error-notification-stub').exists()).toBe(false);
    });
});
