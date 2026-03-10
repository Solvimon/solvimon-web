import { filterOutExpressPaymentMethods } from './paymentMethods';
import type { RawPaymentMethod } from '@adyen/adyen-web';

describe('paymentMethods utils', () => {
    describe('filterOutExpressPaymentMethods', () => {
        it('should filter out Apple Pay payment method', () => {
            const paymentMethods: RawPaymentMethod[] = [
                { type: 'applepay', name: 'Apple Pay' },
                { type: 'scheme', name: 'Credit Card' },
            ];

            const result = filterOutExpressPaymentMethods(paymentMethods);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('scheme');
        });

        it('should filter out all express payment methods', () => {
            const paymentMethods: RawPaymentMethod[] = [
                { type: 'applepay', name: 'Apple Pay' },
                { type: 'scheme', name: 'Credit Card' },
                { type: 'ideal', name: 'iDEAL' },
            ];

            const result = filterOutExpressPaymentMethods(paymentMethods);

            expect(result).toHaveLength(2);
            expect(result.map((m) => m.type)).toEqual(['scheme', 'ideal']);
        });

        it('should handle case-insensitive type matching', () => {
            const paymentMethods: RawPaymentMethod[] = [
                { type: 'APPLEPAY', name: 'Apple Pay' },
                { type: 'scheme', name: 'Credit Card' },
            ];

            const result = filterOutExpressPaymentMethods(paymentMethods);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('scheme');
        });

        it('should return empty array when all payment methods are express', () => {
            const paymentMethods: RawPaymentMethod[] = [{ type: 'applepay', name: 'Apple Pay' }];

            const result = filterOutExpressPaymentMethods(paymentMethods);

            expect(result).toHaveLength(0);
        });

        it('should return all payment methods when none are express', () => {
            const paymentMethods: RawPaymentMethod[] = [
                { type: 'scheme', name: 'Credit Card' },
                { type: 'ideal', name: 'iDEAL' },
                { type: 'klarna', name: 'Klarna' },
            ];

            const result = filterOutExpressPaymentMethods(paymentMethods);

            expect(result).toHaveLength(3);
            expect(result).toEqual(paymentMethods);
        });

        it('should handle empty array', () => {
            const paymentMethods: RawPaymentMethod[] = [];

            const result = filterOutExpressPaymentMethods(paymentMethods);

            expect(result).toHaveLength(0);
        });

        it('should handle payment methods with empty string type', () => {
            const paymentMethods: RawPaymentMethod[] = [
                { type: '', name: 'Unknown' },
                { type: 'scheme', name: 'Credit Card' },
            ];

            const result = filterOutExpressPaymentMethods(paymentMethods);

            expect(result).toHaveLength(2);
            expect(result).toEqual(paymentMethods);
        });

        it('should preserve additional properties on payment methods', () => {
            const paymentMethods: RawPaymentMethod[] = [
                {
                    type: 'scheme',
                    name: 'Credit Card',
                    brands: ['visa', 'mc'],
                },
                {
                    type: 'applepay',
                    name: 'Apple Pay',
                    configuration: { someConfig: true },
                },
            ];

            const result = filterOutExpressPaymentMethods(paymentMethods);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                type: 'scheme',
                name: 'Credit Card',
                brands: ['visa', 'mc'],
            });
        });
    });
});
