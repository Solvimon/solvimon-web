import type { Mock } from 'vitest';
import { createRequestService } from './requests';
import { Headers as HeadersConst } from './requests.lib';
import { ApiError } from './apiError';
import { version } from '../../package.json';

const CLIENT_VERSION = `solvimon-web-v${version}`;

const CALLED_URL = 'https://domain.com/test';
const TOKEN = 'some-token-123';
const loggerError = vi.fn();
const loggerWarn = vi.fn();

const authState = { accessToken: { value: TOKEN } };
vi.mock('@/components/providers/AuthProvider', () => ({
    useAuth: vi.fn(() => authState),
}));
vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: loggerWarn,
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
        loggerWarn.mockClear();
        loggerError.mockClear();
        authState.accessToken.value = TOKEN;
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
    it('reports a failed request under its own code, with the error itself', async () => {
        const request = createRequestService();
        const errorResponse = new Error('Network error');
        mockFetch.mockRejectedValueOnce(errorResponse);

        await expect(request({ url: CALLED_URL })).rejects.toThrow(errorResponse);
        expect(loggerError).toHaveBeenCalledWith(
            'REQUEST_FAILED',
            'Request failed',
            expect.objectContaining({ path: '/test', method: 'GET' }),
            errorResponse,
        );
    });

    it('reports the path only, never the query string a customer appears in', async () => {
        const request = createRequestService();
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(
            request({ url: CALLED_URL, query: { email: 'someone@example.com' } }),
        ).rejects.toThrow();

        const [, , context] = loggerError.mock.calls[0] as [string, string, { path: string }];
        expect(context.path).toBe('/test');
        expect(JSON.stringify(context)).not.toContain('someone@example.com');
    });
    it('sends the token current at request time, not the one captured at construction', async () => {
        const REFRESHED = 'refreshed-token-456';
        const request = createRequestService({ enableAccessCheck: true });

        await request({ url: CALLED_URL });

        expect(mockFetch).toHaveBeenLastCalledWith(
            CALLED_URL,
            expect.objectContaining({
                headers: expect.objectContaining({
                    [HeadersConst.AUTHORIZATION]: `Bearer ${TOKEN}`,
                }),
            }),
        );

        // What the background refresh does to the shared ref, mid-session.
        authState.accessToken.value = REFRESHED;
        await request({ url: CALLED_URL });

        expect(mockFetch).toHaveBeenLastCalledWith(
            CALLED_URL,
            expect.objectContaining({
                headers: expect.objectContaining({
                    [HeadersConst.AUTHORIZATION]: `Bearer ${REFRESHED}`,
                }),
            }),
        );
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

            await expect(request({ url: CALLED_URL })).rejects.toMatchObject({
                name: 'ApiError',
                hasError: true,
                statusCode: 422,
                message: 'VAT number is invalid',
                requestId: 'req_123',
                field: 'vat_number',
            });
        });

        it('rejects with a real Error, so a reporter can title and group it', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(jsonErrorResponse(422, { message: 'Nope' }));

            const rejection: unknown = await request({ url: CALLED_URL }).catch(
                (error: unknown) => error,
            );

            expect(rejection).toBeInstanceOf(ApiError);
            expect(rejection).toBeInstanceOf(Error);
            expect((rejection as Error).stack).toBeTruthy();
        });

        it('carries the request id into the log, which is the join to the backend', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(jsonErrorResponse(500, { message: 'Server error' }));

            await expect(request({ url: CALLED_URL })).rejects.toThrow();

            expect(loggerError).toHaveBeenCalledWith(
                'REQUEST_FAILED',
                'Request failed',
                expect.objectContaining({ statusCode: 500, requestId: 'req_123' }),
                expect.any(ApiError),
            );
        });

        it('groups by endpoint and status rather than by customer', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(jsonErrorResponse(500, {}));

            await expect(request({ url: CALLED_URL })).rejects.toThrow();

            const [, , context] = loggerError.mock.calls[0] as [
                string,
                string,
                { fingerprint: string[] },
            ];
            expect(context.fingerprint).toEqual(['REQUEST_FAILED', 'GET', '/test', '500']);
        });

        it('drops to a warning for a status the caller said it expects', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(jsonErrorResponse(401, {}));

            await expect(
                request({ url: CALLED_URL, options: { expectedStatusCodes: [401] } }),
            ).rejects.toThrow();

            expect(loggerError).not.toHaveBeenCalled();
            expect(loggerWarn).toHaveBeenCalledWith(
                'REQUEST_FAILED',
                'Request failed with an expected status',
                expect.objectContaining({ statusCode: 401 }),
                expect.any(ApiError),
            );
        });

        it('still reports a status the caller did not expect', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(jsonErrorResponse(500, {}));

            await expect(
                request({ url: CALLED_URL, options: { expectedStatusCodes: [401] } }),
            ).rejects.toThrow();

            expect(loggerError).toHaveBeenCalled();
        });

        it('does not report an API error as a parse failure', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(jsonErrorResponse(500, { message: 'Server error' }));

            await expect(request({ url: CALLED_URL })).rejects.toMatchObject({
                statusCode: 500,
                message: 'Server error',
            });
            expect(loggerError).not.toHaveBeenCalledWith(
                'REQUEST_PARSE_FAILED',
                expect.anything(),
                expect.anything(),
                expect.anything(),
            );
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

            await expect(request({ url: CALLED_URL })).rejects.toMatchObject({
                name: 'ApiError',
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

        it('falls back to the status when the error body names no message', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(jsonErrorResponse(404, {}));

            await expect(request({ url: CALLED_URL })).rejects.toMatchObject({
                hasError: true,
                statusCode: 404,
                message: 'Request failed with status 404',
                requestId: 'req_123',
            });
            expect(loggerError).not.toHaveBeenCalledWith(
                'REQUEST_PARSE_FAILED',
                expect.anything(),
                expect.anything(),
                expect.anything(),
            );
        });

        it('rejects when an error status arrives as an HTML page', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: () => Promise.resolve('<html>Internal Server Error</html>'),
                headers: new Headers({
                    'Content-Type': 'text/html; charset=utf-8',
                    [HeadersConst.X_REQUEST_ID]: 'req_789',
                }),
            });

            await expect(request({ url: CALLED_URL })).rejects.toMatchObject({
                hasError: true,
                statusCode: 500,
                requestId: 'req_789',
            });
        });

        it('rejects instead of handing back an error response as a PDF', async () => {
            const request = createRequestService();
            const blob = vi.fn();
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                blob,
                headers: new Headers({
                    'Content-Type': 'application/pdf',
                    [HeadersConst.X_REQUEST_ID]: 'req_pdf',
                }),
            });

            await expect(request({ url: CALLED_URL })).rejects.toMatchObject({
                hasError: true,
                statusCode: 403,
                requestId: 'req_pdf',
            });
            expect(blob).not.toHaveBeenCalled();
        });
    });

    describe('content types', () => {
        const jsonResponse = (body: unknown, contentType: string) => ({
            ok: true,
            status: 200,
            json: () => Promise.resolve(body),
            headers: new Headers({ 'Content-Type': contentType }),
        });

        it('parses a JSON body sent with a charset parameter', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(
                jsonResponse({ id: 'inv_1' }, 'application/json; charset=utf-8'),
            );

            await expect(request({ url: CALLED_URL })).resolves.toEqual({ id: 'inv_1' });
        });

        it('matches the media type regardless of casing', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce(jsonResponse({ id: 'inv_2' }, 'Application/JSON'));

            await expect(request({ url: CALLED_URL })).resolves.toEqual({ id: 'inv_2' });
        });

        it('returns the body as text when the response is genuinely not JSON', async () => {
            const request = createRequestService();
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: () => Promise.resolve('plain body'),
                headers: new Headers({ 'Content-Type': 'text/plain' }),
            });

            await expect(request({ url: CALLED_URL })).resolves.toBe('plain body');
        });

        it('returns a blob for a successful PDF response', async () => {
            const request = createRequestService();
            const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                blob: () => Promise.resolve(pdf),
                headers: new Headers({ 'Content-Type': 'application/pdf' }),
            });

            await expect(request({ url: CALLED_URL })).resolves.toBe(pdf);
        });
    });

    describe('credentials', () => {
        it('omits credentials by default', async () => {
            const request = createRequestService();
            await request({ url: CALLED_URL });

            expect(mockFetch).toHaveBeenCalledWith(
                CALLED_URL,
                expect.objectContaining({ credentials: 'omit' }),
            );
        });

        it('sends them when the caller asks for it', async () => {
            const request = createRequestService();
            await request({ url: CALLED_URL, options: { credentials: 'include' } });

            expect(mockFetch).toHaveBeenCalledWith(
                CALLED_URL,
                expect.objectContaining({ credentials: 'include' }),
            );
        });
    });
});
