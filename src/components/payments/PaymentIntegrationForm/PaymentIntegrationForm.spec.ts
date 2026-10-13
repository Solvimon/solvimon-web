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

type Wrapper = ReturnType<typeof mountForm>;

/** The gateway forms in the order the screen lists them, whichever gateway each one is. */
function forms(wrapper: Wrapper) {
    return [
        ...wrapper.findAllComponents({ name: 'PaymentIntegrationFormAdyen' }),
        ...wrapper.findAllComponents({ name: 'PaymentIntegrationFormStripe' }),
    ].sort((a, b) =>
        a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
}

const validate = (form: ReturnType<typeof forms>[number]) =>
    (form.vm.$attrs['validate-on-submit'] ??
        form.vm.$attrs['validateOnSubmit']) as () => Promise<boolean>;

const adyen = (id: string) =>
    createPaymentMethodOptionEntry({ paymentAcceptorId: `pa_${id}`, integrationId: id });
const stripe = (id: string) =>
    createPaymentMethodOptionEntry({
        paymentAcceptorId: `pa_${id}`,
        integrationId: id,
        gateway: 'STRIPE',
    });

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

    it('tells the screen when the gateway form sends a payment of its own accord', async () => {
        const wrapper = mountForm();
        await flushPromises();

        wrapper.findComponent({ name: 'PaymentIntegrationFormAdyen' }).vm.$emit('submitting');

        expect(wrapper.emitted('submitting')).toHaveLength(1);
    });

    it('tells the screen when the gateway form waits on the customer', async () => {
        const wrapper = mountForm();
        await flushPromises();

        wrapper.findComponent({ name: 'PaymentIntegrationFormAdyen' }).vm.$emit('action-required');

        expect(wrapper.emitted('action-required')).toHaveLength(1);
    });

    it('leaves marking what is missing to the gateway form otherwise', async () => {
        const wrapper = mountForm();
        await flushPromises();

        wrapper.findComponent({ name: 'PaymentIntegrationFormAdyen' }).vm.$emit('invalid');
        await flushPromises();

        expect(wrapper.find('form-message-stub').exists()).toBe(false);
        expect(wrapper.emitted('invalid')).toHaveLength(1);
    });

    describe('with a payment on its way through one of several forms', () => {
        const twoForms = () =>
            mountForm({
                validateOnSubmit: () => Promise.resolve(true),
                paymentMethodOptions: [
                    createPaymentMethodOptionEntry({
                        paymentAcceptorId: 'pa_1',
                        integrationId: 'int_1',
                    }),
                    createPaymentMethodOptionEntry({
                        paymentAcceptorId: 'pa_2',
                        integrationId: 'int_2',
                    }),
                ],
            });

        // A second form's own submit (Enter, its PayPal button) would otherwise pay a second time.
        it('turns down a submit from any other form until that payment is over', async () => {
            const wrapper = twoForms();
            await flushPromises();
            const [first, second] = forms(wrapper);

            first!.vm.$emit('submitting');

            await expect(validate(second!)()).resolves.toBe(false);
            await expect(validate(first!)()).resolves.toBe(true);

            first!.vm.$emit('payment-failed', { code: 'AUTHORIZATION_FAILED', message: 'x' });

            await expect(validate(second!)()).resolves.toBe(true);
        });

        it('keeps the screen waiting on the payment, saying nothing of the turned-down submit', async () => {
            const wrapper = twoForms();
            await flushPromises();
            const [first, second] = forms(wrapper);

            first!.vm.$emit('submitting');
            second!.vm.$emit('invalid');

            expect(wrapper.emitted('invalid')).toBeUndefined();

            first!.vm.$emit('invalid');

            expect(wrapper.emitted('invalid')).toHaveLength(1);
        });
    });
});

describe('PaymentIntegrationForm with one payment in flight across its gateway forms', () => {
    const mountWithOptions = (
        paymentMethodOptions: unknown[],
        validateOnSubmit = vi.fn(async () => true),
    ) => mountForm({ paymentMethodOptions, validateOnSubmit });

    async function mounted(options: unknown[]) {
        const wrapper = mountWithOptions(options);
        await flushPromises();
        // The gateway forms are async components; let their imports settle before the test ends.
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { wrapper, all: forms(wrapper) };
    }

    describe('the record of the form in flight is let go on every outcome', () => {
        it.each([
            [
                'a closed wallet sheet',
                (f: ReturnType<typeof forms>[number]) => f.vm.$emit('invalid'),
            ],
            [
                'an unconfirmed outcome',
                (f: ReturnType<typeof forms>[number]) =>
                    f.vm.$emit('payment-failed', {
                        code: 'PAYMENT_OUTCOME_UNCONFIRMED',
                        message: 'x',
                    }),
            ],
            [
                'a refusal',
                (f: ReturnType<typeof forms>[number]) =>
                    f.vm.$emit('payment-failed', { code: 'AUTHORIZATION_FAILED', message: 'x' }),
            ],
            ['a success', (f: ReturnType<typeof forms>[number]) => f.vm.$emit('payment-success')],
        ])('after %s', async (_, end) => {
            const { all } = await mounted([adyen('a'), adyen('b'), adyen('c')]);
            const [a, b, c] = all;

            b!.vm.$emit('submitting');
            await expect(validate(a!)()).resolves.toBe(false);
            await expect(validate(c!)()).resolves.toBe(false);
            end(b!);

            await expect(validate(a!)()).resolves.toBe(true);
            await expect(validate(c!)()).resolves.toBe(true);
        });

        it('is not set by a validation that threw, which never reaches submitting', async () => {
            const validateOnSubmit = vi.fn().mockRejectedValueOnce(new Error('threw'));
            const wrapper = mountWithOptions([adyen('a'), adyen('b')], validateOnSubmit);
            await flushPromises();
            const [a, b] = forms(wrapper);

            await expect(validate(a!)()).rejects.toThrow('threw');
            a!.vm.$emit('invalid');
            validateOnSubmit.mockResolvedValue(true);

            await expect(validate(b!)()).resolves.toBe(true);
        });

        // A country switch, or anything that changes the options, can take the paying form out of
        // the list mid-payment. Nothing it does after that reaches this record.
        it('lets go when the form in flight leaves the list', async () => {
            const wrapper = mountWithOptions([adyen('a'), adyen('b')]);
            await flushPromises();
            const [a] = forms(wrapper);
            a!.vm.$emit('submitting');

            await wrapper.setProps({ paymentMethodOptions: [adyen('b')] });
            await flushPromises();
            const [b] = forms(wrapper);

            await expect(validate(b!)()).resolves.toBe(true);
        });
    });

    describe('in either order and with three acceptors', () => {
        it.each([
            [0, 1],
            [1, 0],
            [2, 0],
            [0, 2],
        ])('form %i in flight turns down form %i, and only that one', async (paying, other) => {
            const { wrapper, all } = await mounted([adyen('a'), adyen('b'), adyen('c')]);

            all[paying]!.vm.$emit('submitting');
            await expect(validate(all[other]!)()).resolves.toBe(false);
            await expect(validate(all[paying]!)()).resolves.toBe(true);

            all[other]!.vm.$emit('invalid');
            expect(wrapper.emitted('invalid')).toBeUndefined();
            all[paying]!.vm.$emit('invalid');
            expect(wrapper.emitted('invalid')).toHaveLength(1);
        });
    });

    describe('the in-flight form still speaks for itself', () => {
        it('passes on its own invalid, NO_PAYMENT_METHOD included', async () => {
            const { wrapper, all } = await mounted([adyen('a'), adyen('b')]);

            all[0]!.vm.$emit('submitting');
            all[0]!.vm.$emit('invalid', 'NO_PAYMENT_METHOD');
            await flushPromises();

            expect(wrapper.emitted('invalid')).toEqual([['NO_PAYMENT_METHOD']]);
            expect(wrapper.find('form-message-stub').exists()).toBe(true);
        });

        it('passes on its outcome, and only one submitting per payment', async () => {
            const { wrapper, all } = await mounted([adyen('a'), adyen('b')]);

            all[0]!.vm.$emit('submitting');
            all[0]!.vm.$emit('action-required');
            all[0]!.vm.$emit('payment-success');

            expect(wrapper.emitted('submitting')).toHaveLength(1);
            expect(wrapper.emitted('action-required')).toHaveLength(1);
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        it('passes a single form straight through to the screen', async () => {
            const validateOnSubmit = vi.fn(async () => false);
            const wrapper = mountWithOptions([adyen('a')], validateOnSubmit);
            await flushPromises();
            const [a] = forms(wrapper);

            await expect(validate(a!)()).resolves.toBe(false);
            a!.vm.$emit('submitting');
            await expect(validate(a!)()).resolves.toBe(false);
            expect(validateOnSubmit).toHaveBeenCalledTimes(2);
        });
    });

    // A Stripe form pays only through the screen's button, which the screen holds itself. An Adyen
    // form beside it could still pay from Enter in its card fields, which the keyboard reaches
    // while the screen holds the forms.
    it('turns down an Adyen form while a Stripe payment is on its way', async () => {
        const { all } = await mounted([stripe('s'), adyen('a')]);
        const [s, a] = all;
        expect(s!.vm.$options.name ?? s!.vm.$.type.name).toMatch(/Stripe/);

        // What the screen does when its button is pressed with the Stripe form selected.
        await validate(s!)();

        await expect(validate(a!)()).resolves.toBe(false);
    });
});
