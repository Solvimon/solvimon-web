import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import type { PaymentMethod } from '@solvimon/solvimon-types';
import PaymentMethodsList from './PaymentMethodsList.vue';

// ─── Service mock ─────────────────────────────────────────────────────────────

const { mockSetDefaultPaymentMethod } = vi.hoisted(() => ({
    mockSetDefaultPaymentMethod: vi.fn().mockResolvedValue({ id: 'pm_1', is_default: true }),
}));

vi.mock('@/services/paymentMethods', () => ({
    createPaymentMethodsService: () => ({
        setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
    }),
}));

// ─── Context menu composable mock ─────────────────────────────────────────────

let capturedOnDeleteRequest: ((pm: PaymentMethod) => void) | undefined;
let capturedOnSetDefault: ((pm: PaymentMethod) => Promise<void>) | undefined;

vi.mock('@/composables/usePaymentMethodContextMenuOptions', () => ({
    usePaymentMethodContextMenuOptions: (callbacks: {
        onDeleteRequest: (pm: PaymentMethod) => void;
        onSetDefault: (pm: PaymentMethod) => Promise<void>;
    }) => {
        capturedOnDeleteRequest = callbacks.onDeleteRequest;
        capturedOnSetDefault = callbacks.onSetDefault;
        return { getContextMenuItems: vi.fn().mockReturnValue([]) };
    },
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
        Modal: defineComponent({
            name: 'ModalStub',
            props: ['showModal', 'title', 'confirmButtonText', 'cancelButtonText'],
            emits: ['confirm', 'close'],
            template: '<div data-testid="modal-stub"><slot name="body" /></div>',
        }),
        Typography: defineComponent({
            name: 'TypographyStub',
            template: '<p><slot /></p>',
        }),
    });
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const createPaymentMethod = (overrides: Partial<PaymentMethod> = {}) =>
    ({
        id: 'pm_1',
        is_default: false,
        type: 'CARD',
        card: { brand: 'visa', last4: '4242', expiration_month: 12, expiration_year: 2030 },
        ...overrides,
    }) as unknown as PaymentMethod;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mountComponent = (paymentMethods: PaymentMethod[] = [createPaymentMethod()]) =>
    mount(PaymentMethodsList, {
        props: { paymentMethods },
        global: { stubs: { teleport: true } },
    });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PaymentMethodsList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedOnDeleteRequest = undefined;
        capturedOnSetDefault = undefined;
    });

    it('renders a card for each payment method', () => {
        const wrapper = mountComponent([
            createPaymentMethod({ id: 'pm_1' }),
            createPaymentMethod({ id: 'pm_2' }),
        ]);

        expect(wrapper.findAll('[data-testid="payment-method-stub"]')).toHaveLength(2);
    });

    it('renders no cards when the list is empty', () => {
        const wrapper = mountComponent([]);

        expect(wrapper.findAll('[data-testid="payment-method-stub"]')).toHaveLength(0);
    });

    it('hides the delete modal initially', () => {
        const wrapper = mountComponent();

        expect(wrapper.findComponent({ name: 'ModalStub' }).props('showModal')).toBe(false);
    });

    it('shows the delete modal when a delete is requested', async () => {
        const wrapper = mountComponent();

        capturedOnDeleteRequest!(createPaymentMethod());
        await nextTick();

        expect(wrapper.findComponent({ name: 'ModalStub' }).props('showModal')).toBe(true);
    });

    it('renders the payment method to be deleted inside the modal body', async () => {
        const wrapper = mountComponent();
        const pm = createPaymentMethod({ id: 'pm_to_delete' });

        capturedOnDeleteRequest!(pm);
        await nextTick();

        const modalBody = wrapper.find('[data-testid="modal-stub"]');
        expect(modalBody.text()).toContain('pm_to_delete');
    });

    it('emits delete with the payment method and closes the modal when confirmed', async () => {
        const wrapper = mountComponent();
        const pm = createPaymentMethod({ id: 'pm_1' });

        capturedOnDeleteRequest!(pm);
        await nextTick();
        await wrapper.findComponent({ name: 'ModalStub' }).vm.$emit('confirm');
        await nextTick();

        expect(wrapper.emitted('delete')).toHaveLength(1);
        expect(wrapper.emitted('delete')![0]).toEqual([pm]);
        expect(wrapper.findComponent({ name: 'ModalStub' }).props('showModal')).toBe(false);
    });

    it('closes the modal without emitting delete when cancelled', async () => {
        const wrapper = mountComponent();

        capturedOnDeleteRequest!(createPaymentMethod());
        await nextTick();
        await wrapper.findComponent({ name: 'ModalStub' }).vm.$emit('close');
        await nextTick();

        expect(wrapper.emitted('delete')).toBeUndefined();
        expect(wrapper.findComponent({ name: 'ModalStub' }).props('showModal')).toBe(false);
    });

    it('calls setDefaultPaymentMethod and emits set-default when a default is set', async () => {
        const wrapper = mountComponent();
        const pm = createPaymentMethod({ id: 'pm_1' });

        await capturedOnSetDefault!(pm);
        await nextTick();

        expect(mockSetDefaultPaymentMethod).toHaveBeenCalledWith({ paymentMethodId: 'pm_1' });
        expect(wrapper.emitted('set-default')).toHaveLength(1);
    });
});
