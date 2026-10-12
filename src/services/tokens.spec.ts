import { createTokensService } from './tokens';

const { mockRequest, mockCreateRequestService } = vi.hoisted(() => {
    const mockRequest = vi.fn();
    return { mockRequest, mockCreateRequestService: vi.fn(() => mockRequest) };
});

vi.mock('./requests', () => ({
    createRequestService: mockCreateRequestService,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { identity: 'https://identity.test' } }),
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
});
