import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import PaymentIntegrationForm from './PaymentIntegrationForm.vue';
import { createPaymentMethodOptionEntry } from '@/test-utils/paymentMethodOptionsFixture';

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

const mountForm = (props: Record<string, unknown> = {}) =>
    mount(PaymentIntegrationForm, {
        props: {
            countryCode: 'NL',
            variant: 'AUTHORIZE',
            amount: { quantity: '10.00', currency: 'EUR' },
            context: { type: 'INVOICE', invoice: { id: 'inv_1' } },
            paymentMethodOptions: [createPaymentMethodOptionEntry({ gateway: 'ADYEN' })],
            ...props,
        } as never,
        global: {
            stubs: {
                PaymentIntegrationFormAdyen: true,
                PaymentIntegrationFormStripe: true,
                FormMessage: true,
            },
        },
    });

/**
 * Asserted on the rendered attribute rather than `props()`. The gateway forms are async
 * components, so a `true` stub of one declares no props at all and `props()` reads undefined for
 * every one of them — including props that have always worked, which makes it a test that cannot
 * fail for the right reason.
 */
const adyenStub = (wrapper: ReturnType<typeof mountForm>) =>
    wrapper.find('payment-integration-form-adyen-stub');

describe('PaymentIntegrationForm', () => {
    // The SEPA mandate is rendered by the gateway form, but only the screen above knows who is
    // collecting the money, so this hand-off is the one that has to hold.
    it('passes the billing entity name to the gateway form', () => {
        const wrapper = mountForm({ billingEntityName: 'ACME B.V.' });

        expect(adyenStub(wrapper).exists()).toBe(true);
        expect(adyenStub(wrapper).attributes('variant')).toBe('AUTHORIZE');
        expect(adyenStub(wrapper).attributes('billing-entity-name')).toBe('ACME B.V.');
    });

    it('passes nothing on when the screen has no name to give', () => {
        expect(adyenStub(mountForm()).attributes('billing-entity-name')).toBeUndefined();
    });

    it('asks for a payment method when the gateway form has none open', async () => {
        const wrapper = mountForm();
        await flushPromises();
        expect(wrapper.find('form-message-stub').exists()).toBe(false);

        wrapper
            .findComponent({ name: 'PaymentIntegrationFormAdyen' })
            .vm.$emit('invalid', 'NO_PAYMENT_METHOD');
        await flushPromises();

        expect(wrapper.find('form-message-stub').exists()).toBe(true);
        expect(wrapper.emitted('invalid')).toEqual([['NO_PAYMENT_METHOD']]);
    });

    it('leaves marking what is missing to the gateway form otherwise', async () => {
        const wrapper = mountForm();
        await flushPromises();

        wrapper.findComponent({ name: 'PaymentIntegrationFormAdyen' }).vm.$emit('invalid');
        await flushPromises();

        expect(wrapper.find('form-message-stub').exists()).toBe(false);
        expect(wrapper.emitted('invalid')).toHaveLength(1);
    });
});
