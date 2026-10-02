import { describe, expect, it } from 'vitest';
import { ApiError, isApiError } from './apiError';

describe('ApiError', () => {
    it('is a real Error, which is what a reporter needs to title and group it', () => {
        const error = new ApiError({ statusCode: 500 });

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('ApiError');
        expect(error.stack).toBeTruthy();
    });

    it('takes the API message as its own', () => {
        expect(new ApiError({ statusCode: 422, message: 'VAT number is invalid' }).message).toBe(
            'VAT number is invalid',
        );
    });

    it('falls back to the status rather than carrying an empty message', () => {
        expect(new ApiError({ statusCode: 401 }).message).toBe('Request failed with status 401');
        expect(new ApiError({ statusCode: 401, message: '' }).message).toBe(
            'Request failed with status 401',
        );
    });

    it('keeps the fields the object it replaced carried', () => {
        const error = new ApiError({
            statusCode: 422,
            message: 'VAT number is invalid',
            requestId: 'req_123',
            field: 'vat_number',
        });

        expect(error.hasError).toBe(true);
        expect(error.statusCode).toBe(422);
        expect(error.requestId).toBe('req_123');
        expect(error.field).toBe('vat_number');
    });

    it('leaves out a request id the response never carried', () => {
        expect(new ApiError({ statusCode: 500, requestId: null }).requestId).toBeUndefined();
    });

    it('answers the shape checks the SDK recognises a rejection by', () => {
        const error = new ApiError({ statusCode: 401 });

        expect('statusCode' in error).toBe(true);
        expect('hasError' in error).toBe(true);
        expect(isApiError(error)).toBe(true);
        expect(isApiError(new Error('nope'))).toBe(false);
    });
});
