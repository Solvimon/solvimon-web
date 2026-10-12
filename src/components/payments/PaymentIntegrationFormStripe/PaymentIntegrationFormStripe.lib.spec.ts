import type { StripeError } from '@stripe/stripe-js';
import {
    getFrameOptions,
    getFrameOptionsUpdate,
    getFrameTargetOrigin,
    summarizeStripeError,
} from './PaymentIntegrationFormStripe.lib';
import type { Amount } from '@solvimon/solvimon-types';

const EUR_10: Amount = { quantity: '10', currency: 'EUR' };

describe('getFrameOptions', () => {
    describe('TOKENIZE variant', () => {
        it('returns setup mode', () => {
            const result = getFrameOptions({ amount: EUR_10, variant: 'TOKENIZE' });
            expect(result.mode).toBe('setup');
        });

        it('always asks to keep the method, which is what tokenizing is', () => {
            expect(getFrameOptions({ amount: EUR_10, variant: 'TOKENIZE' })).toHaveProperty(
                'setup_future_usage',
                'off_session',
            );
        });

        it('does not include amount', () => {
            const result = getFrameOptions({ amount: EUR_10, variant: 'TOKENIZE' });
            expect(result).not.toHaveProperty('amount');
        });
    });

    describe('AUTHORIZE variant', () => {
        it('returns payment mode', () => {
            const result = getFrameOptions({ amount: EUR_10, variant: 'AUTHORIZE' });
            expect(result.mode).toBe('payment');
        });

        it('converts amount to minor units', () => {
            const result = getFrameOptions({ amount: EUR_10, variant: 'AUTHORIZE' });
            if (result.mode !== 'payment') throw new Error('expected payment mode');
            expect(result.amount).toBe(1000);
        });

        it('asks to keep the method only when it is to be kept', () => {
            expect(
                getFrameOptions({ amount: EUR_10, variant: 'AUTHORIZE', storePaymentMethod: true }),
            ).toHaveProperty('setup_future_usage', 'off_session');
        });

        it('does not ask to keep the method by default', () => {
            // A payment is a payment: keeping the card is a separate thing the customer agrees to.
            expect(getFrameOptions({ amount: EUR_10, variant: 'AUTHORIZE' })).not.toHaveProperty(
                'setup_future_usage',
            );
        });
    });

    it('lowercases the currency', () => {
        const result = getFrameOptions({ amount: EUR_10, variant: 'AUTHORIZE' });
        expect(result.currency).toBe('eur');
    });

    it('suppresses country field collection', () => {
        const result = getFrameOptions({ amount: EUR_10, variant: 'AUTHORIZE' });
        expect(result.fields?.billingDetails?.address?.country).toBe('never');
    });

    it('suppresses email field collection when email is provided', () => {
        const result = getFrameOptions({ amount: EUR_10, variant: 'AUTHORIZE', email: 'a@b.com' });
        expect(result.fields?.billingDetails?.email).toBe('never');
    });

    it('does not suppress email field when no email is provided', () => {
        const result = getFrameOptions({ amount: EUR_10, variant: 'AUTHORIZE' });
        expect(result.fields?.billingDetails).not.toHaveProperty('email');
    });

    it('disables link wallet', () => {
        const result = getFrameOptions({ amount: EUR_10, variant: 'AUTHORIZE' });
        expect(result.wallets?.link).toBe('never');
    });

    it('includes appearance with expected variables and rules', () => {
        const result = getFrameOptions({ amount: EUR_10, variant: 'AUTHORIZE' });
        expect(result.appearance?.variables?.borderRadius).toBe('4px');
        expect(result.appearance?.rules?.['.TermsText']?.fontSize).toBe('14px');
        expect(result.appearance?.rules?.['.Input']?.borderColor).toBe('rgb(229, 231, 235)');
    });
});

describe('getFrameOptionsUpdate', () => {
    const EUR_20: Amount = { quantity: '20', currency: 'EUR' };
    const authorize = (amount: Amount, storePaymentMethod = true, email?: string) =>
        getFrameOptions({ amount, variant: 'AUTHORIZE', storePaymentMethod, email });

    it('updates the amount in place', () => {
        expect(getFrameOptionsUpdate(authorize(EUR_10), authorize(EUR_20))).toMatchObject({
            currency: 'eur',
            amount: 2000,
            setup_future_usage: 'off_session',
        });
    });

    // Leaving it out of an update would leave the earlier value standing.
    it('takes back keeping the method with null', () => {
        expect(getFrameOptionsUpdate(authorize(EUR_10), authorize(EUR_10, false))).toHaveProperty(
            'setup_future_usage',
            null,
        );
    });

    it('sends no amount in setup mode', () => {
        const setup = getFrameOptions({ amount: EUR_10, variant: 'TOKENIZE' });
        expect(getFrameOptionsUpdate(setup, setup)).not.toHaveProperty('amount');
    });

    it('needs a new element when the fields it shows change', () => {
        expect(
            getFrameOptionsUpdate(authorize(EUR_10), authorize(EUR_10, true, 'a@b.c')),
        ).toBeUndefined();
    });

    it('needs a new element when the mode changes', () => {
        expect(
            getFrameOptionsUpdate(
                authorize(EUR_10),
                getFrameOptions({ amount: EUR_10, variant: 'TOKENIZE' }),
            ),
        ).toBeUndefined();
    });
});

describe('getFrameTargetOrigin', () => {
    it('names the page origin', () => {
        expect(getFrameTargetOrigin('https://shop.example')).toBe('https://shop.example');
    });

    // postMessage throws on 'null', and nothing narrower than '*' reaches an opaque origin.
    it('falls back to any origin when the page origin is opaque', () => {
        expect(getFrameTargetOrigin('null')).toBe('*');
    });
});

describe('summarizeStripeError', () => {
    it('keeps the client secret Stripe attaches out of what is logged', () => {
        const error = {
            type: 'card_error',
            code: 'card_declined',
            message: 'Your card was declined.',
            payment_intent: { id: 'pi_1', client_secret: 'pi_1_secret_abc' },
        } as unknown as StripeError;

        expect(summarizeStripeError(error)).toEqual({
            type: 'card_error',
            code: 'card_declined',
            message: 'Your card was declined.',
        });
    });
});
