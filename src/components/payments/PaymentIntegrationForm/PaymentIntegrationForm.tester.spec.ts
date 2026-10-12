import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import PaymentIntegrationForm from './PaymentIntegrationForm.vue';
import { createPaymentMethodOptionEntry } from '@/test-utils/paymentMethodOptionsFixture';

/*
 * DD-3538 round 3, from the tester: the one-payment-at-a-time record PaymentIntegrationForm keeps
 * across the gateway forms of a screen. The gateway forms are stubbed; what they emit is driven by
 * hand, in the order the real forms emit it.
 */

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

const adyen = (id: string) =>
    createPaymentMethodOptionEntry({ paymentAcceptorId: `pa_${id}`, integrationId: id });
const stripe = (id: string) =>
    createPaymentMethodOptionEntry({
        paymentAcceptorId: `pa_${id}`,
        integrationId: id,
        gateway: 'STRIPE',
    });

const mountForm = (paymentMethodOptions: unknown[], validateOnSubmit = vi.fn(async () => true)) =>
    mount(PaymentIntegrationForm, {
        props: {
            countryCode: 'NL',
            variant: 'AUTHORIZE',
            amount: { quantity: '10.00', currency: 'EUR' },
            context: { type: 'INVOICE', invoice: { id: 'inv_1' } },
            paymentMethodOptions,
            validateOnSubmit,
        } as never,
        global: {
            stubs: {
                PaymentIntegrationFormAdyen: true,
                PaymentIntegrationFormStripe: true,
                FormMessage: true,
            },
        },
    });

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

async function mounted(options: unknown[]) {
    const wrapper = mountForm(options);
    await flushPromises();
    // The gateway forms are async components; let their imports settle before the test ends.
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { wrapper, all: forms(wrapper) };
}

describe('PaymentIntegrationForm (DD-3538 round 3 tester)', () => {
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
            const wrapper = mountForm([adyen('a'), adyen('b')], validateOnSubmit);
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
            const wrapper = mountForm([adyen('a'), adyen('b')]);
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
            const wrapper = mountForm([adyen('a')], validateOnSubmit);
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

describe('PaymentIntegrationForm (DD-3538 round 4 tester)', () => {
    /**
     * One validation both submits wait on, as when the screen's validation is still running
     * (Vuelidate's async rules, a VAT lookup) and a second form submits meanwhile: both answers
     * arrive in the same tick.
     */
    function sharedValidation() {
        let release: (ok: boolean) => void = () => {};
        const pending = new Promise<boolean>((resolve) => (release = resolve));
        return { validateOnSubmit: vi.fn(() => pending), release: () => release(true) };
    }

    /** What each gateway form does with the answer, in its own order. */
    function submitAs(form: ReturnType<typeof forms>[number], gateway: 'ADYEN' | 'STRIPE') {
        return validate(form)().then((ok) => {
            // Adyen says `submitting` as soon as its validation is through; Stripe only once the
            // frame has made it a token, after the claim the validation took.
            if (ok && gateway === 'ADYEN') form.vm.$emit('submitting');
            return ok;
        });
    }

    async function race(options: unknown[], gateways: ('ADYEN' | 'STRIPE')[]) {
        const { validateOnSubmit, release } = sharedValidation();
        const wrapper = mountForm(options, validateOnSubmit);
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const all = forms(wrapper);

        const answers = Promise.all(all.map((form, i) => submitAs(form, gateways[i]!)));
        release();
        return (await answers).filter(Boolean).length;
    }

    it('lets one of two Stripe forms through when both submit within one validation', async () => {
        await expect(race([stripe('s1'), stripe('s2')], ['STRIPE', 'STRIPE'])).resolves.toBe(1);
    });

    it('lets one through when Stripe submits first and Adyen joins the same validation', async () => {
        await expect(race([stripe('s'), adyen('a')], ['STRIPE', 'ADYEN'])).resolves.toBe(1);
    });

    // An Adyen form does not claim at validation (`claims: false`) and says `submitting` only in
    // the `then` after it, so a second form whose validation resolves in the same tick re-checks
    // the hold before anyone holds it, and both pay.
    it.fails(
        'lets one of two Adyen forms through when both submit within one validation',
        async () => {
            await expect(race([adyen('a'), adyen('b')], ['ADYEN', 'ADYEN'])).resolves.toBe(1);
        },
    );

    it.fails(
        'lets one through when Adyen submits first and Stripe joins the same validation',
        async () => {
            await expect(race([adyen('a'), stripe('s')], ['ADYEN', 'STRIPE'])).resolves.toBe(1);
        },
    );

    it('lets go of a Stripe claim on each way its submit can end', async () => {
        for (const end of ['invalid', 'payment-failed', 'payment-success'] as const) {
            const { all } = await mounted([stripe('s'), adyen('a')]);
            const [s, a] = all;

            await expect(validate(s!)()).resolves.toBe(true);
            await expect(validate(a!)()).resolves.toBe(false);
            if (end === 'payment-failed') s!.vm.$emit(end, { code: 'AUTHORIZATION_FAILED' });
            else s!.vm.$emit(end);

            await expect(validate(a!)()).resolves.toBe(true);
        }
    });

    it('lets go of a Stripe claim when the Stripe form leaves the list', async () => {
        const wrapper = mountForm([stripe('s'), adyen('a')]);
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const [s] = forms(wrapper);
        await expect(validate(s!)()).resolves.toBe(true);

        await wrapper.setProps({ paymentMethodOptions: [adyen('a')] });
        await flushPromises();
        const [a] = forms(wrapper);

        await expect(validate(a!)()).resolves.toBe(true);
    });

    it('takes no claim for a Stripe form the screen turned down', async () => {
        const validateOnSubmit = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
        const wrapper = mountForm([stripe('s'), adyen('a')], validateOnSubmit);
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const [s, a] = forms(wrapper);

        await expect(validate(s!)()).resolves.toBe(false);
        await expect(validate(a!)()).resolves.toBe(true);
    });
});
