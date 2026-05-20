import { mount } from '@vue/test-utils';
import type { Amount } from '@solvimon/solvimon-types';
import PayButton from './PayButton.vue';
import type { SelectedPaymentMethod } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual = await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    return {
        ...actual,
        useIntl: () => ({
            $t: (
                message: { defaultMessage: string },
                values?: Record<string, string>,
            ) => {
                if (!values) return message.defaultMessage;
                return message.defaultMessage.replace(
                    /\{(\w+)\}/g,
                    (_, key) => values[key] ?? '',
                );
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
