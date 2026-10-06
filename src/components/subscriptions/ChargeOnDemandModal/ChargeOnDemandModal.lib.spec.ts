import { canRetryCharge, getChargeFailure, isInvoiceSettled } from './ChargeOnDemandModal.lib';
import { ApiError } from '@/services/apiError';

describe('getChargeFailure', () => {
    it.each([
        [400, 'payment_method_id', 'PAYMENT_METHOD'],
        [400, 'pricing_plan_subscription_id', 'SUBSCRIPTION_INACTIVE'],
        [400, 'pricing_items.0.units', 'INVALID'],
        [400, undefined, 'INVALID'],
        [404, undefined, 'UNCONFIRMED'],
        [406, undefined, 'IN_PROGRESS'],
        [422, undefined, 'NOT_COMPLETED'],
        [408, undefined, 'UNCONFIRMED'],
        [500, undefined, 'UNCONFIRMED'],
        [502, undefined, 'UNCONFIRMED'],
    ])('reads a %i on %s as %s', (statusCode, field, failure) => {
        expect(getChargeFailure(new ApiError({ statusCode, field }))).toBe(failure);
    });

    it('treats a request that got no response as unconfirmed', () => {
        expect(getChargeFailure(new TypeError('Failed to fetch'))).toBe('UNCONFIRMED');
    });
});

describe('canRetryCharge', () => {
    it('lets the customer try again only when no invoice can have been created', () => {
        expect(canRetryCharge('PAYMENT_METHOD')).toBe(true);
        expect(canRetryCharge('INVALID')).toBe(true);
        expect(canRetryCharge('SUBSCRIPTION_INACTIVE')).toBe(false);
        expect(canRetryCharge('NOT_COMPLETED')).toBe(false);
        expect(canRetryCharge('IN_PROGRESS')).toBe(false);
        expect(canRetryCharge('UNCONFIRMED')).toBe(false);
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
