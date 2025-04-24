import { vi, type Mock } from 'vitest';
import { createRequestService } from './requests';
import { Headers as HeadersConst } from './requests.lib';

const CALLED_URL = 'https://domain.com/test';
const TOKEN = 'some-token-123';
vi.mock('@/components/AuthProvider', () => ({
    useAuth: vi.fn(() => ({ accessToken: { value: TOKEN } })),
}));

describe('createRequestService', () => {
    let mockFetch: Mock;

    beforeEach(() => {
        mockFetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => ({}),
                headers: new Headers({ 'Content-Type': 'application/json' }),
            })
        );
        global.fetch = mockFetch;
    });

    describe('headers', () => {
        const request = createRequestService();

        it('sends default headers when there are no overrides', async () => {
            const request = createRequestService({ enableAccessCheck: false });
            await request({ url: CALLED_URL });

            expect(mockFetch).toHaveBeenCalledWith(
                CALLED_URL,
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        [HeadersConst.CONTENT_TYPE]: 'application/json',
                    },
                })
            );
        });

        it('includes Authorization header when enableAccessToken is true', async () => {
            const request = createRequestService({ enableAccessCheck: true });
            await request({ url: CALLED_URL });

            expect(mockFetch).toHaveBeenCalledWith(
                CALLED_URL,
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        [HeadersConst.CONTENT_TYPE]: 'application/json',
                        [HeadersConst.AUTHORIZATION]: `Bearer ${TOKEN}`,
                    },
                })
            );
        });

        it('merges additional headers when overrides are provided', async () => {
            const CUSTOM_HEADERS = {
                'custom-header-one': 'some value',
                'custom-header-two': 'another value',
            };

            await request({
                url: CALLED_URL,
                options: {
                    headers: CUSTOM_HEADERS,
                },
            });

            expect(mockFetch).toHaveBeenCalledWith(
                CALLED_URL,
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        [HeadersConst.CONTENT_TYPE]: 'application/json',
                        [HeadersConst.AUTHORIZATION]: `Bearer ${TOKEN}`,
                        ...CUSTOM_HEADERS,
                    },
                })
            );
        });

        it('overrides existing headers with provided values', async () => {
            const request = createRequestService({ enableAccessCheck: false });
            const CUSTOM_HEADERS = {
                [HeadersConst.CONTENT_TYPE]: 'text/plain',
            };

            await request({
                url: CALLED_URL,
                options: {
                    headers: CUSTOM_HEADERS,
                },
            });

            expect(mockFetch).toHaveBeenCalledWith(
                CALLED_URL,
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        [HeadersConst.CONTENT_TYPE]: 'text/plain',
                    },
                })
            );
        });

        it('removes headers when value is explicitly set to null', async () => {
            const request = createRequestService({ enableAccessCheck: false });
            const CUSTOM_HEADERS = {
                [HeadersConst.CONTENT_TYPE]: null,
            };

            await request({
                url: CALLED_URL,
                options: {
                    headers: CUSTOM_HEADERS,
                },
            });

            expect(mockFetch).toHaveBeenCalledWith(
                CALLED_URL,
                expect.objectContaining({
                    method: 'GET',
                    headers: {},
                })
            );
        });
    });
    it('Applies query params', async () => {
        const request = createRequestService();

        const queryParams = {
            param1: 'value1',
            param2: 'value2',
        };

        await request({
            url: CALLED_URL,
            query: queryParams,
        });

        expect(mockFetch).toHaveBeenCalledWith(
            `${CALLED_URL}?param1=value1&param2=value2`,
            expect.anything()
        );
    });
});
