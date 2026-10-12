import type { AuthorizePaymentResponse } from '@solvimon/solvimon-types';
import {
    getAuthorizeOutcome,
    getPaymentDetailsOutcome,
    getStripeIntentOutcome,
    isOutcomeUnknownAfterError,
} from './paymentOutcome';
import { ApiError } from '@/services/apiError';

const authorizeResponse = (status: string, result?: string) =>
    ({
        status,
        ...(result ? { payment: { result } } : {}),
    }) as unknown as AuthorizePaymentResponse;

describe('getAuthorizeOutcome', () => {
    it('succeeds on an authorized payment', () => {
        expect(getAuthorizeOutcome(authorizeResponse('SUCCESS', 'AUTHORIZED'))).toBe('SUCCEEDED');
    });

    it('succeeds on a tokenization, which answers without a payment', () => {
        expect(getAuthorizeOutcome(authorizeResponse('SUCCESS'))).toBe('SUCCEEDED');
    });

    // SEPA and other asynchronous methods report SUCCESS with a payment still pending. Calling
    // that a failure invited the customer to pay again.
    it('leaves a pending payment unconfirmed rather than failed', () => {
        expect(getAuthorizeOutcome(authorizeResponse('SUCCESS', 'PENDING'))).toBe('UNCONFIRMED');
    });

    it.each(['REFUSED', 'ERROR', 'CANCELLED'])('fails a %s payment', (result) => {
        expect(getAuthorizeOutcome(authorizeResponse('SUCCESS', result))).toBe('FAILED');
    });

    it.each(['FAILURE', 'REFUSED'])('fails a %s response', (status) => {
        expect(getAuthorizeOutcome(authorizeResponse(status, 'AUTHORIZED'))).toBe('FAILED');
    });
});

describe('getPaymentDetailsOutcome', () => {
    it.each([
        ['SUCCESS', 'SUCCEEDED'],
        ['FAILURE', 'FAILED'],
        ['REFUSED', 'FAILED'],
        ['ACTION_REQUIRED', 'UNCONFIRMED'],
        ['PENDING', 'UNCONFIRMED'],
    ])('reads %s as %s', (payment_status, outcome) => {
        expect(getPaymentDetailsOutcome({ payment_status } as never)).toBe(outcome);
    });
});

describe('getStripeIntentOutcome', () => {
    it.each([
        ['succeeded', 'SUCCEEDED'],
        ['requires_capture', 'SUCCEEDED'],
        ['processing', 'UNCONFIRMED'],
        [undefined, 'UNCONFIRMED'],
        ['requires_payment_method', 'FAILED'],
        ['requires_action', 'FAILED'],
        ['canceled', 'FAILED'],
    ])('reads %s as %s', (status, outcome) => {
        expect(getStripeIntentOutcome(status)).toBe(outcome);
    });
});

describe('isOutcomeUnknownAfterError', () => {
    it('cannot tell when the request never got an answer', () => {
        expect(isOutcomeUnknownAfterError(new TypeError('Failed to fetch'))).toBe(true);
    });

    it.each([500, 502, 503, 504, 408])('cannot tell after a %i', (statusCode) => {
        expect(isOutcomeUnknownAfterError(new ApiError({ statusCode }))).toBe(true);
    });

    it('cannot tell when a success body could not be read', () => {
        expect(isOutcomeUnknownAfterError(new ApiError({ statusCode: 200 }))).toBe(true);
    });

    it.each([400, 402, 404, 422])('knows a %i was turned down', (statusCode) => {
        expect(isOutcomeUnknownAfterError(new ApiError({ statusCode }))).toBe(false);
    });
});
