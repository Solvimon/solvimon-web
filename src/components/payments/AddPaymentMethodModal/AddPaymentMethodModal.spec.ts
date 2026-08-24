import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type { Customer } from '@solvimon/solvimon-types';
import AddPaymentMethodModal from './AddPaymentMethodModal.vue';

const { mockSubmit, mockIsPaymentPending } = vi.hoisted(() => ({
    mockSubmit: vi.fn(),
    mockIsPaymentPending: { value: false },
}));

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        // The real modal teleports and resolves its own providers.
        Modal: defineComponent({
            name: 'ModalStub',
            props: { showModal: Boolean, isLoading: Boolean, title: String },
            emits: ['confirm', 'close'],
            setup:
                (props, { slots }) =>
                () =>
                    h(
                        'div',
                        {
                            class: 'sv-modal-stub',
                            'data-open': String(props.showModal),
                            'data-loading': String(props.isLoading),
                        },
                        slots.body?.(),
                    ),
        }),
    });
});

vi.mock('@/public/components/PaymentMethodForm/PaymentMethodForm.vue', () => ({
    default: defineComponent({
        name: 'PaymentMethodFormStub',
        props: { customer: Object, paymentMethodOptions: Array, hideSubmitButton: Boolean },
        emits: ['success', 'failure'],
        setup(_, { expose }) {
            expose({ submit: mockSubmit, isPaymentPending: mockIsPaymentPending.value });
            return () => h('div', { class: 'sv-payment-method-form-stub' });
        },
    }),
}));

const customer = { id: 'cus_1' } as unknown as Customer;

const mountComponent = async (props: Record<string, unknown> = {}) => {
    const wrapper = mount(AddPaymentMethodModal, {
        props: { showModal: true, customer, paymentMethodOptions: [], ...props },
    });

    await flushPromises();

    return wrapper;
};

describe('AddPaymentMethodModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the payment method form once opened', async () => {
        const wrapper = await mountComponent();

        expect(wrapper.find('.sv-payment-method-form-stub').exists()).toBe(true);
    });

    it('hides the form own submit button, since the modal footer submits it', async () => {
        const wrapper = await mountComponent();

        expect(
            wrapper.findComponent({ name: 'PaymentMethodFormStub' }).props('hideSubmitButton'),
        ).toBe(true);
    });

    it('does not build the form before the modal has ever opened', async () => {
        const wrapper = await mountComponent({ showModal: false });

        expect(wrapper.find('.sv-payment-method-form-stub').exists()).toBe(false);
    });

    it('keeps the form mounted after being closed again', async () => {
        const wrapper = await mountComponent();

        await wrapper.setProps({ showModal: false });

        expect(wrapper.find('.sv-payment-method-form-stub').exists()).toBe(true);
    });

    it('submits the form from the modal confirm button', async () => {
        const wrapper = await mountComponent();

        wrapper.findComponent({ name: 'ModalStub' }).vm.$emit('confirm');

        expect(mockSubmit).toHaveBeenCalled();
    });

    it('reports a stored payment method', async () => {
        const wrapper = await mountComponent();

        wrapper.findComponent({ name: 'PaymentMethodFormStub' }).vm.$emit('success');

        expect(wrapper.emitted('success')).toHaveLength(1);
    });

    it('forwards a failed attempt', async () => {
        const wrapper = await mountComponent();
        const failure = new Error('declined');

        wrapper.findComponent({ name: 'PaymentMethodFormStub' }).vm.$emit('failure', failure);

        expect(wrapper.emitted('failure')?.[0]).toEqual([failure]);
    });

    it('reports the customer dismissing it', async () => {
        const wrapper = await mountComponent();

        wrapper.findComponent({ name: 'ModalStub' }).vm.$emit('close');

        expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('renders nothing to fill in without a customer to store against', async () => {
        const wrapper = await mountComponent({ customer: undefined });

        expect(wrapper.find('.sv-payment-method-form-stub').exists()).toBe(false);
    });
});
