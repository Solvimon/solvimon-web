import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Customer, PaymentMethod } from '@solvimon/solvimon-types';
import PaymentMethodSelector from './PaymentMethodSelector.vue';

// ─── UI library mock ──────────────────────────────────────────────────────────

// The real RadioGroupExtended is kept, so the `show-radio` / prefix-slot contract this component
// relies on is genuinely exercised. Only the payment method row is stubbed, since its internal
// useIntl deep-import bypasses the global mock.
vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        PaymentMethod: defineComponent({
            name: 'PaymentMethodStub',
            props: ['paymentMethod'],
            setup: (props) => () =>
                h(
                    'div',
                    { 'data-testid': 'payment-method-stub' },
                    (props as { paymentMethod?: { id?: string } }).paymentMethod?.id,
                ),
        }),
        // No declared props, so `disabled` and the click listener land on the button itself.
        Button: defineComponent({
            name: 'ButtonStub',
            template: '<button data-testid="add-button"><slot /></button>',
        }),
    });
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const createPaymentMethod = (overrides: Partial<PaymentMethod> = {}) =>
    ({
        id: 'pm_1',
        reference: 'ref_1',
        is_default: false,
        status: 'ACTIVE',
        type: 'CARD',
        card: { brand: 'VISA', last_four_digits: '4242' },
        ...overrides,
    }) as unknown as PaymentMethod;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mountComponent = (
    props: Partial<InstanceType<typeof PaymentMethodSelector>['$props']> = {},
) =>
    mount(PaymentMethodSelector, {
        props: { paymentMethods: [createPaymentMethod()], ...props },
        attachTo: document.body,
    });

const rows = (wrapper: ReturnType<typeof mountComponent>) =>
    wrapper.findAll('[data-testid="payment-method-stub"]');

const radios = (wrapper: ReturnType<typeof mountComponent>) =>
    wrapper.findAll<HTMLInputElement>('input[type="radio"]');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PaymentMethodSelector', () => {
    it('renders one radio option per saved payment method', () => {
        const wrapper = mountComponent({
            paymentMethods: [
                createPaymentMethod({ id: 'pm_1' }),
                createPaymentMethod({ id: 'pm_2' }),
            ],
        });

        expect(radios(wrapper)).toHaveLength(2);
        expect(radios(wrapper).map((radio) => radio.element.value)).toEqual(['pm_1', 'pm_2']);
    });

    it('renders every option with the shared PaymentMethod component', () => {
        const wrapper = mountComponent({
            paymentMethods: [
                createPaymentMethod({ id: 'pm_1' }),
                createPaymentMethod({ id: 'pm_2' }),
            ],
        });

        expect(rows(wrapper).map((row) => row.text())).toEqual(['pm_1', 'pm_2']);
    });

    it('hides the radio dot, putting the payment method row in its place', () => {
        const wrapper = mountComponent();

        // The dot is the only thing the group renders when showRadio is true.
        expect(wrapper.find('.rounded-full').exists()).toBe(false);
        expect(rows(wrapper)).toHaveLength(1);
    });

    it('does not repeat the payment method as visible option text', () => {
        const wrapper = mountComponent({
            paymentMethods: [
                createPaymentMethod({
                    id: 'pm_1',
                    card: { brand: 'VISA', last_four_digits: '4242' },
                } as Partial<PaymentMethod>),
            ],
        });

        // The group falls back to rendering `label` when the label slot is empty, so the accessible
        // name has to be present but screen-reader only. Scoped to a span: the group also hides its
        // own radio input with `sr-only`.
        const srOnly = wrapper.find('span.sr-only');
        expect(srOnly.exists()).toBe(true);
        expect(srOnly.text()).toBe('Visa 4242');
    });

    it('gives each option an accessible name even though the row is a component', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('label').attributes('aria-label')).toBe('Visa 4242');
    });

    it('marks the selected payment method as checked', () => {
        const wrapper = mountComponent({
            paymentMethods: [
                createPaymentMethod({ id: 'pm_1' }),
                createPaymentMethod({ id: 'pm_2' }),
            ],
            modelValue: 'pm_2',
        });

        expect(radios(wrapper).map((radio) => radio.element.checked)).toEqual([false, true]);
    });

    it('emits update:modelValue with the id of the chosen payment method', async () => {
        const wrapper = mountComponent({
            paymentMethods: [
                createPaymentMethod({ id: 'pm_1' }),
                createPaymentMethod({ id: 'pm_2' }),
            ],
        });

        await radios(wrapper)[1].setValue();

        expect(wrapper.emitted('update:modelValue')).toEqual([['pm_2']]);
    });

    it('offers an add button below the options by default', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('[data-testid="add-button"]').text()).toBe('Add payment method');
    });

    it('asks the surrounding screen to take over when the add button is used', async () => {
        const wrapper = mountComponent();

        await wrapper.find('[data-testid="add-button"]').trigger('click');

        // The form for adding lives with the parent, which usually swaps its whole body over.
        expect(wrapper.emitted('add-payment-method')).toHaveLength(1);
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('hides the add button when showAddOption is false', () => {
        const wrapper = mountComponent({ showAddOption: false });

        expect(wrapper.find('[data-testid="add-button"]').exists()).toBe(false);
    });

    it('renders the group label', () => {
        const wrapper = mountComponent({ label: 'Pay with' });

        expect(wrapper.find('legend').text()).toContain('Pay with');
    });

    it('renders the error message when one is given', () => {
        const wrapper = mountComponent({ error: 'Select a payment method' });

        expect(wrapper.text()).toContain('Select a payment method');
    });

    it('disables the options and the add button when disabled', () => {
        const wrapper = mountComponent({ disabled: true });

        expect(radios(wrapper)[0].element.disabled).toBe(true);
        expect(wrapper.find('[data-testid="add-button"]').attributes('disabled')).toBeDefined();
    });

    it('applies the given rootClass alongside its own', () => {
        const wrapper = mountComponent({ rootClass: 'my-class' });

        expect(wrapper.classes()).toEqual(
            expect.arrayContaining(['sv-payment-method-selector', 'my-class']),
        );
    });
});
