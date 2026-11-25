import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import PaymentAcceptorsModal from './PaymentAcceptorsModal.vue';
import type { PaymentAcceptorsModalProps } from './PaymentAcceptorsModal.types';
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
        Toggle: defineComponent({
            name: 'ToggleStub',
            props: { modelValue: Boolean, disabled: Boolean },
            emits: ['update:modelValue'],
            setup: () => () => h('div', { class: 'toggle-stub' }),
        }),
        CheckboxGroupExtended: defineComponent({
            name: 'CheckboxGroupExtendedStub',
            props: { modelValue: Array, options: Array, disabled: Boolean, error: String },
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

const subscription: PaymentAcceptorsModalProps['subscription'] = {
    id: 'ppsu_1',
    assignment: { mode: 'selected', paymentAcceptorIds: ['main'] },
    payerName: 'Tivoli',
};

const mountComponent = (props: Partial<PaymentAcceptorsModalProps> = {}) =>
    mount(PaymentAcceptorsModal, {
        props: {
            showModal: true,
            paymentAcceptors: [acceptor('main'), acceptor('other'), acceptor('old', 'ARCHIVED')],
            subscription,
            create: vi.fn().mockResolvedValue(acceptor('new')),
            saveChoice: vi.fn().mockResolvedValue(undefined),
            ...props,
        },
    });

const choices = (wrapper: ReturnType<typeof mountComponent>) =>
    wrapper.findComponent({ name: 'CheckboxGroupExtendedStub' });

const useAllToggle = (wrapper: ReturnType<typeof mountComponent>) =>
    wrapper.findComponent({ name: 'ToggleStub' });

const usingAll = {
    ...subscription,
    assignment: { mode: 'all-active' },
} satisfies PaymentAcceptorsModalProps['subscription'];

describe('PaymentAcceptorsModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmit.mockResolvedValue({
            method: 'CREATE',
            details: { name: 'New account', type: 'BANK_ACCOUNT' },
        });
    });

    it('validates and creates once when confirmed twice during validation', async () => {
        const create = vi.fn().mockResolvedValue(acceptor('new'));
        const wrapper = mountComponent({ paymentAcceptors: [], subscription: usingAll, create });
        const confirm = wrapper.get('.modal__confirm');

        await Promise.all([confirm.trigger('click'), confirm.trigger('click')]);
        await flushPromises();

        expect(mockSubmit).toHaveBeenCalledTimes(1);
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('offers only the active acceptors, with the linked ones ticked', () => {
        const wrapper = mountComponent();

        expect(
            (choices(wrapper).props('options') as { value: string }[]).map(({ value }) => value),
        ).toEqual(['main', 'other']);
        expect(choices(wrapper).props('modelValue')).toEqual(['main']);
    });

    it('says the chosen acceptors are what the payer picks from', () => {
        const wrapper = mountComponent();

        expect(wrapper.findComponent({ name: 'ModalStub' }).props('subTitle')).toBe(
            'Choose the payment acceptors Tivoli can pick from when paying you.',
        );
    });

    it('opens with the toggle off when the subscription has chosen acceptors', () => {
        const wrapper = mountComponent();

        expect(useAllToggle(wrapper).props('modelValue')).toBe(false);
        expect(choices(wrapper).props('disabled')).toBe(false);
    });

    it('opens with the toggle on and every active acceptor ticked and locked when none is chosen', () => {
        const wrapper = mountComponent({ subscription: usingAll });

        expect(useAllToggle(wrapper).props('modelValue')).toBe(true);
        expect(choices(wrapper).props('modelValue')).toEqual(['main', 'other']);
        expect(choices(wrapper).props('disabled')).toBe(true);
    });

    it('saves an empty list while the toggle is on', async () => {
        const saveChoice = vi.fn().mockResolvedValue(undefined);
        const wrapper = mountComponent({ saveChoice });

        useAllToggle(wrapper).vm.$emit('update:modelValue', true);
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(saveChoice).toHaveBeenCalledWith({ mode: 'all-active' });
    });

    it('ticks every active acceptor when the toggle is turned off', async () => {
        const wrapper = mountComponent({ subscription: usingAll });

        useAllToggle(wrapper).vm.$emit('update:modelValue', false);
        await wrapper.vm.$nextTick();

        expect(choices(wrapper).props('modelValue')).toEqual(['main', 'other']);
        expect(choices(wrapper).props('disabled')).toBe(false);
    });

    it('keeps the selection when the toggle goes on and off again before saving', async () => {
        const wrapper = mountComponent();

        useAllToggle(wrapper).vm.$emit('update:modelValue', true);
        useAllToggle(wrapper).vm.$emit('update:modelValue', false);
        await wrapper.vm.$nextTick();

        expect(choices(wrapper).props('modelValue')).toEqual(['main']);
    });

    it('refuses to save with the toggle off and nothing ticked', async () => {
        const saveChoice = vi.fn();
        const wrapper = mountComponent({ saveChoice });

        choices(wrapper).vm.$emit('update:modelValue', []);
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(saveChoice).not.toHaveBeenCalled();
        expect(choices(wrapper).props('error')).toBe(
            'Select at least one payment acceptor, or turn on Use all.',
        );
        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('saves the chosen acceptors and closes', async () => {
        const saveChoice = vi.fn().mockResolvedValue(undefined);
        const wrapper = mountComponent({ saveChoice });

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(saveChoice).toHaveBeenCalledWith({ mode: 'selected', paymentAcceptorIds: ['main'] });
        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('stays open and says so when the choice cannot be saved', async () => {
        const saveChoice = vi.fn().mockRejectedValue(new Error('down'));
        const wrapper = mountComponent({ saveChoice });

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.find('.error-notification-stub').exists()).toBe(true);
        expect(wrapper.emitted('close')).toBeUndefined();
        expect(mockLoggerError).toHaveBeenCalledWith(
            'SUBSCRIPTION_PAYMENT_ACCEPTORS_SAVE_FAILED',
            expect.any(String),
            {},
            expect.any(Error),
        );
    });

    it('goes back to choosing after adding one, with the new one ticked', async () => {
        const create = vi.fn().mockResolvedValue(acceptor('new'));
        const wrapper = mountComponent({ create });

        await wrapper.find('.sv-payment-acceptors-modal__add').trigger('click');
        expect(wrapper.find('.modal__title').text()).toBe('New payment acceptor');
        expect(wrapper.find('.modal__cancel').text()).toBe('Back');

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(create).toHaveBeenCalledWith({ name: 'New account', type: 'BANK_ACCOUNT' });
        expect(wrapper.find('.modal__title').text()).toBe('Assign payment acceptors');
        expect(choices(wrapper).props('modelValue')).toEqual(['main', 'new']);
    });

    it('leaves the toggle on after adding one, so the new one applies with the rest', async () => {
        const saveChoice = vi.fn().mockResolvedValue(undefined);
        const wrapper = mountComponent({ subscription: usingAll, saveChoice });

        await wrapper.find('.sv-payment-acceptors-modal__add').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(useAllToggle(wrapper).props('modelValue')).toBe(true);

        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(saveChoice).toHaveBeenCalledWith({ mode: 'all-active' });
    });

    it('stores nothing while the form is incomplete', async () => {
        mockSubmit.mockResolvedValue(undefined);
        const create = vi.fn();
        const wrapper = mountComponent({ create });

        await wrapper.find('.sv-payment-acceptors-modal__add').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(create).not.toHaveBeenCalled();
    });

    it('hands a refused field to the form rather than a general error', async () => {
        const create = vi
            .fn()
            .mockRejectedValue(
                new ApiError({ statusCode: 400, field: 'iban', message: 'Bad IBAN' }),
            );
        const wrapper = mountComponent({ create });

        await wrapper.find('.sv-payment-acceptors-modal__add').trigger('click');
        await wrapper.find('.modal__confirm').trigger('click');
        await flushPromises();

        expect(wrapper.findComponent({ name: 'PaymentAcceptorForm' }).props('apiError')).toEqual({
            iban: "This value isn't accepted. Check it and try again.",
        });
        expect(wrapper.find('.error-notification-stub').exists()).toBe(false);
    });

    it('starts on adding when there is nothing to choose from, and cancelling closes', async () => {
        const wrapper = mountComponent({
            paymentAcceptors: [],
            subscription: usingAll,
        });

        expect(wrapper.find('.modal__title').text()).toBe('New payment acceptor');

        await wrapper.find('.modal__cancel').trigger('click');

        expect(wrapper.emitted('close')).toHaveLength(1);
    });
});
