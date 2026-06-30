import { getFrameOptions } from './PaymentIntegrationFormStripe.lib';
import type { Amount } from '@solvimon/solvimon-types';

const EUR_10: Amount = { quantity: '10', currency: 'EUR' };

describe('getFrameOptions', () => {
    describe('TOKENIZE variant', () => {
        it('returns setup mode', () => {
            const result = getFrameOptions({ amount: EUR_10, variant: 'TOKENIZE' });
            expect(result.mode).toBe('setup');
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
