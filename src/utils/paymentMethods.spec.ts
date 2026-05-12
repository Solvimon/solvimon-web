import {
    filterOutExpressPaymentMethods,
    getExpressPaymentMethodOptions,
    getPaymentMethodOptionsWithoutExpress,
} from './paymentMethods';
import type { RawPaymentMethod } from '@adyen/adyen-web';
import type { PaymentMethodOption, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';

const makeOption = (name: string): PaymentMethodOption =>
    ({ name }) as unknown as PaymentMethodOption;

const makeResponse = (
    ...groups: (PaymentMethodOption[] | undefined)[]
): PaymentMethodOptionsResponse =>
    groups.map((options) => ({ options })) as unknown as PaymentMethodOptionsResponse;

describe('paymentMethods utils', () => {
    describe('getExpressPaymentMethodOptions', () => {
        it('returns Apple Pay options from the response', () => {
            const response = makeResponse([makeOption('Apple Pay'), makeOption('Credit Card')]);
            const result = getExpressPaymentMethodOptions(response);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Apple Pay');
        });

        it('is case-insensitive when matching option names', () => {
            const response = makeResponse([makeOption('APPLE PAY'), makeOption('iDEAL')]);
            const result = getExpressPaymentMethodOptions(response);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('APPLE PAY');
        });

        it('returns empty array when no express options are present', () => {
            const response = makeResponse([makeOption('Credit Card'), makeOption('iDEAL')]);
            expect(getExpressPaymentMethodOptions(response)).toEqual([]);
        });

        it('returns empty array when options is undefined', () => {
            const response = makeResponse(undefined);
            expect(getExpressPaymentMethodOptions(response)).toEqual([]);
        });

        it('collects express options across multiple entries', () => {
            const response = makeResponse(
                [makeOption('Credit Card')],
                [makeOption('Apple Pay')],
                [makeOption('Apple Pay'), makeOption('iDEAL')],
            );
            const result = getExpressPaymentMethodOptions(response);
            expect(result).toHaveLength(2);
        });
    });

    describe('getPaymentMethodOptionsWithoutExpress', () => {
        it('removes entries whose only option is an express method', () => {
            const response = makeResponse(
                [makeOption('Apple Pay')],
                [makeOption('Credit Card')],
            );
            const result = getPaymentMethodOptionsWithoutExpress(response);
            expect(result).toHaveLength(1);
            expect(result[0].options![0].name).toBe('Credit Card');
        });

        it('filters express options from a mixed entry and keeps the entry', () => {
            const response = makeResponse([makeOption('Apple Pay'), makeOption('iDEAL')]);
            const result = getPaymentMethodOptionsWithoutExpress(response);
            expect(result).toHaveLength(1);
            expect(result[0].options).toHaveLength(1);
            expect(result[0].options![0].name).toBe('iDEAL');
        });

        it('returns empty array when all entries are express-only', () => {
            const response = makeResponse([makeOption('Apple Pay')], [makeOption('Apple Pay')]);
            expect(getPaymentMethodOptionsWithoutExpress(response)).toEqual([]);
        });

        it('preserves entries with no options by dropping them (0 filtered options)', () => {
            const response = makeResponse(undefined, [makeOption('iDEAL')]);
            const result = getPaymentMethodOptionsWithoutExpress(response);
            expect(result).toHaveLength(1);
            expect(result[0].options![0].name).toBe('iDEAL');
        });

        it('returns empty array for an empty response', () => {
            expect(getPaymentMethodOptionsWithoutExpress([] as unknown as PaymentMethodOptionsResponse)).toEqual([]);
        });
    });

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
