import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type { Customer, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import AddPaymentMethodModal from './AddPaymentMethodModal.vue';

const { mockUseOptions, mockSubmit, isSaving } = vi.hoisted(() => ({
    mockUseOptions: vi.fn(),
    mockSubmit: vi.fn(),
    isSaving: { value: false },
}));

vi.mock('@/composables/useCustomerPaymentMethodOptions', () => ({
    useCustomerPaymentMethodOptions: mockUseOptions,
}));

// Starts a payment gateway; its own spec covers storing the method.
vi.mock('@/components/payments/AddPaymentMethodPane/AddPaymentMethodPane.vue', () => ({
    default: defineComponent({
        name: 'AddPaymentMethodPane',
        props: {
            customer: Object,
            paymentMethodOptions: Array,
            isLoading: Boolean,
            isActive: Boolean,
        },
        emits: ['success', 'failure'],
        setup(_, { expose }) {
            expose({
                submit: mockSubmit,
                get isSaving() {
                    return isSaving.value;
                },
            });
            return () => h('div', { class: 'add-payment-method-pane-stub' });
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
            setup(props, { slots, emit }) {
                return () =>
                    props.showModal
                        ? h('div', { class: 'modal' }, [
                              h('h1', { class: 'modal__title' }, props.title),
                              h('p', { class: 'modal__subtitle' }, props.subTitle),
                              h('div', { class: 'modal__body' }, slots.body?.()),
                              h(
                                  'button',
                                  { class: 'modal__confirm', onClick: () => emit('confirm') },
                                  props.confirmButtonText,
                              ),
                              h(
                                  'button',
                                  { class: 'modal__cancel', onClick: () => emit('close') },
                                  props.cancelButtonText,
                              ),
                          ])
                        : null;
            },
        }),
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup: (props) => () => h('div', { class: 'error-notification-stub' }, props.title),
        }),
    });
});

const customer = { id: 'cus_1', type: 'INDIVIDUAL' } as unknown as Customer;

const option = (acceptorId: string) => ({ payment_acceptor: { id: acceptorId } });

const options = [
    option('paya_subscription'),
    option('paya_other'),
] as unknown as PaymentMethodOptionsResponse;

const mountComponent = (props: Record<string, unknown> = {}) =>
    mount(AddPaymentMethodModal, {
        props: { showModal: true, customer, ...props },
    });

describe('AddPaymentMethodModal', () => {
    let onError: ((error: unknown) => void) | undefined;

    beforeEach(() => {
        vi.clearAllMocks();
        isSaving.value = false;
        onError = undefined;
        mockUseOptions.mockImplementation((args: { onError?: (error: unknown) => void }) => {
            onError = args.onError;
            return { settledOptions: ref(options), isPending: ref(false) };
        });
    });

    const pane = (wrapper: ReturnType<typeof mountComponent>) =>
        wrapper.findComponent({ name: 'AddPaymentMethodPane' });

    it('asks for a method to store, with what it is for underneath', () => {
        const wrapper = mountComponent({
            subTitle: 'Add a payment method to pay for your subscription.',
        });

        expect(wrapper.find('.modal__title').text()).toBe('Add payment method');
        expect(wrapper.find('.modal__subtitle').text()).toBe(
            'Add a payment method to pay for your subscription.',
        );
        expect(wrapper.find('.modal__confirm').text()).toBe('Save payment method');
    });

    it('falls back to a generic line when the host says nothing about what it is for', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.modal__subtitle').text()).toBe('Add a new payment method.');
    });

    it('offers the ways the customer can pay', () => {
        const wrapper = mountComponent();

        expect(pane(wrapper).props('customer')).toEqual(customer);
        expect(pane(wrapper).props('paymentMethodOptions')).toEqual(options);
    });

    it('offers only the ways a subscription accepts, when it is for one', () => {
        const wrapper = mountComponent({
            subscription: { id: 'ppsu_1', payment_acceptor_ids: ['paya_subscription'] },
        });

        expect(pane(wrapper).props('paymentMethodOptions')).toEqual([option('paya_subscription')]);
        expect(mockUseOptions).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: expect.objectContaining({ value: 'ppsu_1' }),
            }),
        );
    });

    it('saves through the form when the customer confirms', async () => {
        const wrapper = mountComponent();

        await wrapper.find('.modal__confirm').trigger('click');

        expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    it('reports a stored method, so the host can pick it up', async () => {
        const wrapper = mountComponent();

        pane(wrapper).vm.$emit('success');
        await flushPromises();

        expect(wrapper.emitted('stored')).toHaveLength(1);
    });

    it('passes a failed save on to the host', async () => {
        const wrapper = mountComponent();
        const failure = new Error('declined');

        pane(wrapper).vm.$emit('failure', failure);
        await flushPromises();

        expect(wrapper.emitted('failure')).toEqual([[failure]]);
    });

    it('closes when the customer cancels', async () => {
        const wrapper = mountComponent();

        await wrapper.find('.modal__cancel').trigger('click');

        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    // The gateway owns the save once it is out, so leaving would abandon it half done.
    it('stays open while a save is in flight', async () => {
        const wrapper = mountComponent();
        isSaving.value = true;
        await wrapper.setProps({ subTitle: 'refresh' });

        await wrapper.find('.modal__cancel').trigger('click');

        expect(wrapper.emitted('close')).toBeUndefined();
    });

    it('says so when the ways to pay cannot be loaded', async () => {
        const wrapper = mountComponent();

        onError?.(new Error('down'));
        await flushPromises();

        expect(wrapper.find('.error-notification-stub').exists()).toBe(true);
        expect(pane(wrapper).exists()).toBe(false);
    });
});
