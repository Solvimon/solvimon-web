import type { RawPaymentMethod } from '@adyen/adyen-web';
import type { PaymentMethod } from '@solvimon/solvimon-types';
import { filterOutExpressPaymentMethods, isExpiredCard } from './paymentMethods';

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

describe('isExpiredCard', () => {
    const card = (expiry_date?: { expiry_month: number; expiry_year: number }) =>
        ({
            id: 'pmet_1',
            type: 'CARD',
            status: 'ACTIVE',
            card: { brand: 'VISA', last_four_digits: '4242', expiry_date },
        }) as PaymentMethod;
    const expiring = (expiry_month: number, expiry_year: number) =>
        card({ expiry_month, expiry_year });

    it.each([
        ['through the last day of its expiry month', '2026-03-31T23:59:59Z', false],
        ['from the first day of the month after', '2026-04-01T00:00:00Z', true],
    ])('keeps a card valid %s', (_, now, expired) => {
        expect(isExpiredCard(expiring(3, 2026), new Date(now))).toBe(expired);
    });

    it('rolls an expiry in December over to the next year', () => {
        expect(isExpiredCard(expiring(12, 2026), new Date('2026-12-31T12:00:00Z'))).toBe(false);
        expect(isExpiredCard(expiring(12, 2026), new Date('2027-01-01T00:00:00Z'))).toBe(true);
    });

    it('never calls a card without an expiry date, or another type, expired', () => {
        expect(isExpiredCard(card())).toBe(false);
        expect(
            isExpiredCard({ id: 'pmet_dd', type: 'DIRECT_DEBIT' } as unknown as PaymentMethod),
        ).toBe(false);
    });
});
