import { vi } from 'vitest';
import { getDefaultHeaders, Headers } from './request.lib';

const TOKEN = 'some-token-123';
vi.mock('@/components/AuthProvider', () => ({
    useAuth: vi.fn(() => ({ accessToken: { value: TOKEN } })),
}));

describe('request lib', () => {
    describe('getDefaultHeaders() util', () => {
        it('returns the default headers when there are no overrides', () => {
            const result = getDefaultHeaders({ enableAccessToken: false });

            expect(result).toEqual({
                [Headers.CONTENT_TYPE]: 'application/json',
            });
        });

        it('returns headers with Authorization when enableAccessToken is true', () => {
            const result = getDefaultHeaders({ enableAccessToken: true });

            expect(result).toEqual({
                [Headers.CONTENT_TYPE]: 'application/json',
                [Headers.AUTHORIZATION]: `Bearer ${TOKEN}`,
            });
        });

        it('merges additional headers when overrides are provided', () => {
            const CUSTOM_HEADERS = {
                'custom-header-one': 'some value',
                'custom-header-two': 'another value',
            };
            const result = getDefaultHeaders({ headers: CUSTOM_HEADERS, enableAccessToken: true });

            expect(result).toEqual({
                [Headers.CONTENT_TYPE]: 'application/json',
                [Headers.AUTHORIZATION]: `Bearer ${TOKEN}`,
                ...CUSTOM_HEADERS,
            });
        });

        it('overrides existing headers with provided values', () => {
            const CUSTOM_HEADERS = {
                [Headers.CONTENT_TYPE]: 'text/plain',
            };
            const result = getDefaultHeaders({ headers: CUSTOM_HEADERS, enableAccessToken: false });

            expect(result).toEqual({
                [Headers.CONTENT_TYPE]: 'text/plain',
            });
        });

        it('removes headers when value is explicitly set to null', () => {
            const CUSTOM_HEADERS = {
                [Headers.CONTENT_TYPE]: null,
            };
            const result = getDefaultHeaders({ headers: CUSTOM_HEADERS, enableAccessToken: false });

            expect(result).toEqual({});
        });
    });
});
