import { beforeEach, describe, expect, it } from 'vitest';
import {
    createPaymentFailureContext,
    createPaymentFailureError,
    extractApiFailureDetails,
} from './paymentFailure';
import { getSessionReference, resetSessionReference } from './sessionReference';

describe('extractApiFailureDetails', () => {
    it('lifts the fields a failed API call carries', () => {
        expect(
            extractApiFailureDetails({
                hasError: true,
                statusCode: 422,
                message: 'Payment acceptor is not configured',
                requestId: 'req_123',
                field: 'payment_acceptor_id',
            }),
        ).toEqual({
            requestId: 'req_123',
            statusCode: 422,
            apiMessage: 'Payment acceptor is not configured',
        });
    });

    it('leaves out what the rejection did not carry', () => {
        expect(
            extractApiFailureDetails({ hasError: true, statusCode: 500, requestId: null }),
        ).toEqual({ statusCode: 500 });
    });

    it('returns nothing for anything that is not an API rejection', () => {
        expect(extractApiFailureDetails(new Error('network error'))).toEqual({});
        expect(extractApiFailureDetails('boom')).toEqual({});
        expect(extractApiFailureDetails(undefined)).toEqual({});
        expect(extractApiFailureDetails(null)).toEqual({});
    });
});

describe('createPaymentFailureContext', () => {
    beforeEach(() => resetSessionReference());

    it('carries what a failure has to be traced by', () => {
        const context = createPaymentFailureContext({
            reason: 'PAYMENT_AUTHORIZATION_FAILED',
            gateway: 'STRIPE',
            paymentAcceptorId: 'paya_123',
            paymentMethodType: 'card',
            variant: 'AUTHORIZE',
            invoiceId: 'inv_123',
            customerId: 'cus_123',
            cause: { hasError: true, statusCode: 502, requestId: 'req_456' },
            extra: { stripeErrorCode: 'card_declined' },
        });

        expect(context).toEqual({
            fingerprint: ['PAYMENT_AUTHORIZATION_FAILED', 'STRIPE', 'paya_123'],
            reason: 'PAYMENT_AUTHORIZATION_FAILED',
            gateway: 'STRIPE',
            reference: getSessionReference(),
            paymentAcceptorId: 'paya_123',
            paymentMethodType: 'card',
            variant: 'AUTHORIZE',
            invoiceId: 'inv_123',
            customerId: 'cus_123',
            statusCode: 502,
            requestId: 'req_456',
            stripeErrorCode: 'card_declined',
        });
    });

    it('groups by what failed and where, so one broken acceptor stays one issue', () => {
        const forCustomer = (customerId: string) =>
            createPaymentFailureContext({
                reason: 'ADYEN_PAYMENT_FAILED',
                gateway: 'ADYEN',
                paymentAcceptorId: 'paya_123',
                customerId,
            }).fingerprint;

        expect(forCustomer('cus_1')).toEqual(forCustomer('cus_2'));
        expect(forCustomer('cus_1')).toEqual(['ADYEN_PAYMENT_FAILED', 'ADYEN', 'paya_123']);
    });

    it('omits the acceptor from the fingerprint when there is none to group on', () => {
        expect(
            createPaymentFailureContext({ reason: 'ADYEN_SUBMIT_FAILED', gateway: 'ADYEN' })
                .fingerprint,
        ).toEqual(['ADYEN_SUBMIT_FAILED', 'ADYEN']);
    });

    it('leaves out every field the caller had nothing for', () => {
        expect(
            Object.keys(
                createPaymentFailureContext({ reason: 'ADYEN_SUBMIT_FAILED', gateway: 'ADYEN' }),
            ).sort(),
        ).toEqual(['fingerprint', 'gateway', 'reason', 'reference']);
    });
});

describe('createPaymentFailureError', () => {
    beforeEach(() => resetSessionReference());

    it('gives the card the reference the customer can quote', () => {
        expect(
            createPaymentFailureError({ code: 'AUTHORIZATION_FAILED', message: 'Payment failed' }),
        ).toEqual({
            code: 'AUTHORIZATION_FAILED',
            message: 'Payment failed',
            reference: getSessionReference(),
        });
    });

    it('is the same reference every failure in the session gets', () => {
        const first = createPaymentFailureError({ code: 'UNKNOWN_ERROR', message: 'one' });
        const second = createPaymentFailureError({ code: 'TOKENIZE_FAILED', message: 'two' });

        expect(first.reference).toBe(second.reference);
    });
});
