import { getChargeError, isInvoiceSettled, isFixableChargeError } from './ChargeOnDemandModal.lib';
import { ApiError } from '@/services/apiError';

describe('getChargeError', () => {
    it.each([
        [400, 'payment_method_id', 'PAYMENT_METHOD'],
        [400, 'pricing_items', 'PRICING_ITEMS'],
        [400, 'pricing_items.0.units.number', 'PRICING_ITEMS'],
        [400, 'pricing_items.1.flexible_amount', 'PRICING_ITEMS'],
        [400, 'pricing_plan_subscription_id', 'SUBSCRIPTION_INACTIVE'],
        [400, 'pricing_plan_schedule_id', 'FAILED'],
        [400, 'reference', 'FAILED'],
        [400, undefined, 'FAILED'],
        [401, undefined, 'FAILED'],
        [404, undefined, 'FAILED'],
        [406, undefined, 'FAILED'],
        [408, undefined, 'FAILED'],
        [422, undefined, 'PAYMENT_FAILED'],
        [500, undefined, 'FAILED'],
        [502, undefined, 'FAILED'],
    ])('reads a %i on %s as %s', (statusCode, field, outcome) => {
        expect(getChargeError(new ApiError({ statusCode, field }))).toBe(outcome);
    });

    it('treats a request that got no response as failed', () => {
        expect(getChargeError(new TypeError('Failed to fetch'))).toBe('FAILED');
    });
});

describe('isFixableChargeError', () => {
    it('keeps the customer on the order only for what they can fix there', () => {
        expect(isFixableChargeError('PAYMENT_METHOD')).toBe(true);
        expect(isFixableChargeError('PRICING_ITEMS')).toBe(true);
        expect(isFixableChargeError('SUBSCRIPTION_INACTIVE')).toBe(true);
        expect(isFixableChargeError('PAYMENT_FAILED')).toBe(false);
        expect(isFixableChargeError('FAILED')).toBe(false);
    });
});

describe('isInvoiceSettled', () => {
    it.each([
        ['PAID', true],
        ['OVERPAID', true],
        ['UNPAID', false],
        ['PARTIALLY_PAID', false],
        [null, false],
        [undefined, false],
    ] as const)('treats %s as settled: %s', (payment_status, settled) => {
        expect(isInvoiceSettled({ payment_status })).toBe(settled);
    });
});
