import { mount } from '@vue/test-utils';
import type { Amount } from '@solvimon/solvimon-types';
import PayButton from './PayButton.vue';
import type { SelectedPaymentMethod } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

const { translations } = vi.hoisted(() => ({ translations: {} as Record<string, string> }));

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual =
        await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    return {
        ...actual,
        useIntl: () => ({
            $t: (
                message: { id: string; defaultMessage: string },
                values?: Record<string, string>,
            ) => {
                const text = translations[message.id] ?? message.defaultMessage;
                if (!values) return text;
                return text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
            },
        }),
        formatAmount: (amount: Amount) => `${amount.currency} ${amount.quantity}`,
    };
});

const amount: Amount = { currency: 'EUR', quantity: '10.00' };

function paymentMethod(paymentMethodType: string): SelectedPaymentMethod {
    return { paymentGatewayVariant: 'ADYEN', paymentMethodType };
}

describe('PayButton', () => {
    it('shows the default "Pay" label when no amount or payment method is provided', () => {
        const wrapper = mount(PayButton);
        expect(wrapper.text()).toBe('Pay');
    });

    it('shows amount in label when only amount is provided', () => {
        const wrapper = mount(PayButton, { props: { amount } });
        expect(wrapper.text()).toContain('EUR 10.00');
    });

    it('shows amount and payment method type when both are provided', () => {
        const wrapper = mount(PayButton, {
            props: { amount, paymentMethod: paymentMethod('scheme') },
        });
        expect(wrapper.text()).toBe('Pay EUR 10.00 with Credit Card');
    });

    it("names card payments in the customer's language", () => {
        translations['pay_button.payment_method.card'] = 'Creditcard';

        const wrapper = mount(PayButton, {
            props: { amount, paymentMethod: paymentMethod('scheme') },
        });

        delete translations['pay_button.payment_method.card'];
        expect(wrapper.text()).toBe('Pay EUR 10.00 with Creditcard');
    });

    it.each([
        ['applepay', 'Apple Pay'],
        ['googlepay', 'Google Pay'],
        ['paypal', 'PayPal'],
        ['ideal', 'iDeal'],
        ['klarna', 'Klarna'],
        ['sepadirectdebit', 'SEPA'],
        ['facilypay_3x', 'Oney'],
        ['facilypay_4x', 'Oney'],
    ])('maps payment method type "%s" to label "%s"', (type, label) => {
        const wrapper = mount(PayButton, {
            props: { amount, paymentMethod: paymentMethod(type) },
        });
        expect(wrapper.text()).toContain(label);
    });

    it('capitalizes unknown payment method types', () => {
        const wrapper = mount(PayButton, {
            props: { amount, paymentMethod: paymentMethod('bancontact') },
        });
        expect(wrapper.text()).toContain('Bancontact');
    });

    it('emits a click event when the button is clicked', async () => {
        const wrapper = mount(PayButton);
        await wrapper.find('button').trigger('click');
        expect(wrapper.emitted('click')).toHaveLength(1);
    });

    it('renders a disabled button when disabled prop is true', () => {
        const wrapper = mount(PayButton, { props: { disabled: true } });
        expect(wrapper.find('button').attributes('disabled')).toBeDefined();
    });
});
