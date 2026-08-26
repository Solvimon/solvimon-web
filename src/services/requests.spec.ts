import type { Mock } from 'vitest';
import { createRequestService } from './requests';
import { Headers as HeadersConst } from './requests.lib';
import { version } from '../../package.json';

const CLIENT_VERSION = `solvimon-web-v${version}`;

const CALLED_URL = 'https://domain.com/test';
const TOKEN = 'some-token-123';
const onError = vi.fn();
const loggerError = vi.fn();

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual =
        await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');

    return {
        ...actual,
        useErrorHandling: () => ({
            onError,
        }),
    };
});
vi.mock('@/components/providers/AuthProvider', () => ({
    useAuth: vi.fn(() => ({ accessToken: { value: TOKEN } })),
}));
vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: loggerError,
        capture: vi.fn(),
    }),
}));

describe('createRequestService', () => {
    let mockFetch: Mock;

    beforeEach(() => {
        mockFetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => ({}),
                headers: new Headers({ 'Content-Type': 'application/json' }),
            }),
        );
        global.fetch = mockFetch;
    });

    afterEach(() => {
        onError.mockClear();
        loggerError.mockClear();
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
                        [HeadersConst.X_CLIENT_VERSION]: CLIENT_VERSION,
                    },
                }),
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
                        [HeadersConst.X_CLIENT_VERSION]: CLIENT_VERSION,
                    },
                }),
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
                        [HeadersConst.X_CLIENT_VERSION]: CLIENT_VERSION,
                        ...CUSTOM_HEADERS,
                    },
                }),
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
                        [HeadersConst.X_CLIENT_VERSION]: CLIENT_VERSION,
                    },
                }),
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
                    headers: {
                        [HeadersConst.X_CLIENT_VERSION]: CLIENT_VERSION,
                    },
                }),
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
            expect.anything(),
        );
    });
    it('Expands array query params and leaves out empty ones', async () => {
        const request = createRequestService();

        await request({
            url: CALLED_URL,
            query: {
                expand: ['ALL'],
                statuses: ['ACTIVE', 'DRAFT'],
                customer_id: 'cust_1',
                page: 1,
                missing: undefined,
                cleared: null,
            },
        });

        expect(mockFetch).toHaveBeenCalledWith(
            `${CALLED_URL}?expand%5B%5D=ALL&statuses%5B%5D=ACTIVE&statuses%5B%5D=DRAFT&customer_id=cust_1&page=1`,
            expect.anything(),
        );
    });
    it('Calls onError when fetch fails', async () => {
        const request = createRequestService();
        const errorResponse = new Error('Network error');
        mockFetch.mockRejectedValueOnce(errorResponse);

        await expect(request({ url: CALLED_URL })).rejects.toThrow(errorResponse);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ cause: errorResponse }));
    });
    describe('error responses', () => {
        const jsonErrorResponse = (
            status: number,
            body: unknown,
            requestId = 'req_123',
        ): Partial<Response> => ({
            ok: false,
            status,
            json: () => Promise.resolve(body),
            headers: new Headers({
                'Content-Type': 'application/json',
                [HeadersConst.X_REQUEST_ID]: requestId,
            }),
        });

        it('rejects with the message and field the API sent', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(
                jsonErrorResponse(422, {
                    message: 'VAT number is invalid',
                    field: 'vat_number',
                }),
            );

            await expect(request({ url: CALLED_URL })).rejects.toEqual({
                hasError: true,
                statusCode: 422,
                message: 'VAT number is invalid',
                requestId: 'req_123',
                field: 'vat_number',
            });
        });

        it('does not report an API error as a parse failure', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(jsonErrorResponse(500, { message: 'Server error' }));

            await expect(request({ url: CALLED_URL })).rejects.toMatchObject({
                statusCode: 500,
                message: 'Server error',
            });
            expect(loggerError).not.toHaveBeenCalled();
        });

        it('rejects with a parse failure when the body is not valid JSON', async () => {
            const request = createRequestService();
            const parseError = new SyntaxError('Unexpected token < in JSON at position 0');
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 502,
                json: () => Promise.reject(parseError),
                headers: new Headers({
                    'Content-Type': 'application/json',
                    [HeadersConst.X_REQUEST_ID]: 'req_456',
                }),
            });

            await expect(request({ url: CALLED_URL })).rejects.toEqual({
                hasError: true,
                statusCode: 502,
                requestId: 'req_456',
            });
            expect(loggerError).toHaveBeenCalledWith(
                'REQUEST_PARSE_FAILED',
                'Failed to parse JSON response',
                {},
                parseError,
            );
        });

        it('leaves message and field undefined when the error body has neither', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(jsonErrorResponse(404, {}));

            await expect(request({ url: CALLED_URL })).rejects.toEqual({
                hasError: true,
                statusCode: 404,
                message: undefined,
                requestId: 'req_123',
                field: undefined,
            });
            expect(loggerError).not.toHaveBeenCalled();
        });
    });
});
