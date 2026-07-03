import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import type { Customer, PaymentMethod, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import PaymentMethodsManagement from './PaymentMethodsManagement.vue';
import PaymentMethodsList from '@/components/payments/PaymentMethodsList/PaymentMethodsList.vue';

// ─── Service mocks ────────────────────────────────────────────────────────────

const { mockSetDefaultPaymentMethod } = vi.hoisted(() => ({
    mockSetDefaultPaymentMethod: vi.fn().mockResolvedValue({ id: 'pm_1', is_default: true }),
}));

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: () => ({
        setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
        getPaymentMethods: vi.fn().mockResolvedValue({ data: [] }),
        getPaymentMethodOptions: vi.fn().mockResolvedValue([]),
        tokenizePaymentMethod: vi.fn(),
    }),
}));

// ─── UI library mock ──────────────────────────────────────────────────────────

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        PaymentMethod: defineComponent({
            name: 'PaymentMethodStub',
            props: ['paymentMethod', 'options'],
            setup(props) {
                return () =>
                    h(
                        'div',
                        { 'data-testid': 'payment-method-stub' },
                        (props as { paymentMethod?: { id?: string } }).paymentMethod?.id,
                    );
            },
        }),
        ContextMenu: defineComponent({
            name: 'ContextMenuStub',
            props: ['items'],
            template: '<div data-testid="context-menu-stub" />',
        }),
        Modal: defineComponent({
            name: 'ModalStub',
            props: ['showModal', 'title', 'confirmButtonText', 'cancelButtonText', 'isLoading'],
            emits: ['confirm', 'close'],
            template: '<div data-testid="modal-stub"><slot name="body" /></div>',
        }),
    });
});

// ─── Component stubs ──────────────────────────────────────────────────────────

vi.mock('@/public/components/PaymentMethodForm/PaymentMethodForm.vue', () => ({
    default: defineComponent({
        name: 'PaymentMethodFormStub',
        template: '<div data-testid="payment-method-form" />',
    }),
}));

// ─── Test fixtures ────────────────────────────────────────────────────────────

const mockCustomer = {
    id: 'cus_123',
    email: 'test@example.com',
    reference: 'CUS-001',
    type: 'INDIVIDUAL',
} as unknown as Customer;

const createPaymentMethod = (overrides: Partial<PaymentMethod> = {}) =>
    ({
        id: 'pm_1',
        is_default: true,
        type: 'CARD',
        card: { brand: 'visa', last4: '4242', expiration_month: 12, expiration_year: 2030 },
        ...overrides,
    }) as unknown as PaymentMethod;

const mockPaymentMethodOptions: PaymentMethodOptionsResponse = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mountComponent = (props: Record<string, unknown> = {}) =>
    mount(PaymentMethodsManagement, {
        props: {
            isLoading: false,
            customer: mockCustomer,
            paymentMethods: [createPaymentMethod()],
            paymentMethodOptions: mockPaymentMethodOptions,
            ...props,
        },
        global: { stubs: { teleport: true } },
    });

const getButtonByText = (wrapper: ReturnType<typeof mountComponent>, label: string) => {
    const button = wrapper.findAll('button').find((b) => b.text() === label);
    expect(button, `Button "${label}" not found`).toBeDefined();
    return button!;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PaymentMethodsManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders a card for each payment method', () => {
        const wrapper = mountComponent({
            paymentMethods: [
                createPaymentMethod({ id: 'pm_1' }),
                createPaymentMethod({ id: 'pm_2' }),
            ],
        });

        expect(wrapper.findAll('[data-testid="payment-method-stub"]')).toHaveLength(2);
    });

    it('renders no cards when the payment methods list is empty', () => {
        const wrapper = mountComponent({ paymentMethods: [] });

        expect(wrapper.findAll('[data-testid="payment-method-stub"]')).toHaveLength(0);
    });

    it('shows the "Add payment method" button by default', () => {
        const wrapper = mountComponent();

        expect(wrapper.text()).toContain('Add payment method');
    });

    it('shows the payment method form when "Add payment method" is clicked', async () => {
        const wrapper = mountComponent();

        expect(wrapper.find('[data-testid="payment-method-form"]').exists()).toBe(false);

        await getButtonByText(wrapper, 'Add payment method').trigger('click');

        expect(wrapper.find('[data-testid="payment-method-form"]').exists()).toBe(true);
    });

    it('shows "Cancel" and hides "Add payment method" while the form is open', async () => {
        const wrapper = mountComponent();

        await getButtonByText(wrapper, 'Add payment method').trigger('click');

        expect(wrapper.text()).not.toContain('Add payment method');
        expect(wrapper.text()).toContain('Cancel');
    });

    it('hides the form and shows the button again when "Cancel" is clicked', async () => {
        const wrapper = mountComponent();

        await getButtonByText(wrapper, 'Add payment method').trigger('click');
        await getButtonByText(wrapper, 'Cancel').trigger('click');

        expect(wrapper.find('[data-testid="payment-method-form"]').exists()).toBe(false);
        expect(wrapper.text()).toContain('Add payment method');
    });

    it('emits "set-default" when the payment methods list signals a default was set', async () => {
        const wrapper = mountComponent();

        wrapper.findComponent(PaymentMethodsList).vm.$emit('set-default', createPaymentMethod());
        await nextTick();

        expect(wrapper.emitted('set-default')).toHaveLength(1);
    });
});
