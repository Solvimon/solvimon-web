import { createTokensService } from './tokens';

const { mockRequest, mockCreateRequestService } = vi.hoisted(() => {
    const mockRequest = vi.fn();
    return { mockRequest, mockCreateRequestService: vi.fn(() => mockRequest) };
});

vi.mock('./requests', () => ({
    createRequestService: mockCreateRequestService,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({
        apiUrls: { identity: 'https://identity.test', transaction: 'https://api.test/v1' },
    }),
}));

describe('tokens service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequest.mockResolvedValue({ access_token: 'token', expires_in: 300 });
    });

    describe('getAccessToken', () => {
        it('asks for a token for the given alias', async () => {
            const { getAccessToken } = createTokensService();
            await getAccessToken('alias');

            expect(mockRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://identity.test/oauth/token',
                    data: { token_alias: 'alias' },
                }),
            );
        });

        // The response sets the `refresh-token` cookie the session is renewed with. Under `omit`
        // the browser drops it, and the session dies the moment the first access token expires.
        it('sends credentials so the browser keeps the refresh cookie', async () => {
            const { getAccessToken } = createTokensService();
            await getAccessToken('alias');

            expect(mockCreateRequestService).toHaveBeenCalledWith(
                expect.objectContaining({ enableAccessCheck: false, includeRefreshCookie: true }),
            );
        });
    });

    describe('refreshAccessToken', () => {
        // The endpoint takes no body and no bearer: the cookie is the only credential it has.
        it('sends credentials so the refresh cookie reaches identity', async () => {
            const { refreshAccessToken } = createTokensService();
            await refreshAccessToken();

            expect(mockCreateRequestService).toHaveBeenCalledWith(
                expect.objectContaining({ includeRefreshCookie: true }),
            );
            expect(mockRequest).toHaveBeenCalledWith(
                expect.objectContaining({ url: 'https://identity.test/oauth/refresh-token' }),
            );
        });

        it('treats a 401 as expected', async () => {
            const { refreshAccessToken } = createTokensService();
            await refreshAccessToken();

            expect(mockRequest.mock.calls[0][0].options.expectedStatusCodes).toEqual([401]);
        });
    });

    describe('exchangeHandle', () => {
        beforeEach(() => {
            mockRequest.mockResolvedValue({
                issued_at: '2026-10-22T10:00:00.000Z',
                access_token: 'portal-token',
                access_token_expires_in: 2712,
                access_token_expires_at: '2026-10-22T10:45:12.000Z',
                token_type: 'bearer',
            });
        });

        it('posts the handle as it is to the transaction API', async () => {
            const { exchangeHandle } = createTokensService();
            await exchangeHandle('cHVybF8x.random');

            expect(mockRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://api.test/v1/portal/token',
                    data: { handle: 'cHVybF8x.random' },
                }),
            );
            expect(mockRequest.mock.calls[0][0].options).toMatchObject({ method: 'POST' });
        });

        // The handle is the credential: a bearer or a cookie would only leak something.
        it('sends neither a bearer nor credentials', async () => {
            const { exchangeHandle } = createTokensService();
            await exchangeHandle('cHVybF8x.random');

            expect(mockCreateRequestService).toHaveBeenCalledWith(
                expect.not.objectContaining({ includeRefreshCookie: true }),
            );
            expect(mockCreateRequestService).toHaveBeenCalledWith(
                expect.objectContaining({ enableAccessCheck: false }),
            );
        });

        it('treats a dead link, an unknown handle and an unverified link as expected', async () => {
            const { exchangeHandle } = createTokensService();
            await exchangeHandle('cHVybF8x.random');

            expect(mockRequest.mock.calls[0][0].options.expectedStatusCodes).toEqual([
                401, 410, 429, 500, 502, 503, 504,
            ]);
        });

        it('refuses a success that carries no token', async () => {
            mockRequest.mockResolvedValue({ token_type: 'bearer' });
            const { exchangeHandle } = createTokensService();

            await expect(exchangeHandle('cHVybF8x.random')).rejects.toThrow();
        });

        it('answers with the token and the seconds the link has left', async () => {
            const { exchangeHandle } = createTokensService();

            await expect(exchangeHandle('cHVybF8x.random')).resolves.toEqual({
                access_token: 'portal-token',
                expires_in: 2712,
                token_type: 'bearer',
            });
        });
    });
});
