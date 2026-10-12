import type { Token } from '@solvimon/solvimon-types';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { getAuth } from './AuthProvider.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { createTokensService } from '@/services/tokens';

const { mockGetAccessToken, mockRefreshAccessToken, mockLogError, mockParseToken } = vi.hoisted(
    () => ({
        mockGetAccessToken: vi.fn<() => Promise<Partial<Token>>>(),
        mockRefreshAccessToken: vi.fn<() => Promise<Token>>(),
        mockLogError: vi.fn(),
        mockParseToken: vi.fn(),
    }),
);

const REFRESHED_TOKEN = 'refreshed-token-456';
const BAD_TOKEN = 'not-a-portal-token';

const tokenResponse = (accessToken: string, expiresIn = 3600): Token => ({
    access_token: accessToken,
    expires_in: expiresIn,
    token_type: 'bearer',
});

const createLogger = (error = vi.fn()): Logger => ({
    error,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    capture: vi.fn(),
});

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: vi.fn(),
}));

vi.mock('@/services/tokens', () => ({
    createTokensService: vi.fn(),
}));

vi.mock('@/utils/token', () => ({
    parseToken: mockParseToken,
}));

let tokenCounter = 0;
const uniqueToken = () => `portal-token-${++tokenCounter}`;

function withSetup(token: string) {
    let auth!: ReturnType<typeof getAuth>;
    const wrapper = mount(
        defineComponent({
            setup() {
                auth = getAuth(token);
                return {};
            },
            template: '<div />',
        }),
    );
    return { auth, wrapper };
}

describe('getAuth', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(useLogger).mockImplementation(() => createLogger(mockLogError));
        vi.mocked(createTokensService).mockImplementation(() => ({
            getAccessToken: mockGetAccessToken as () => Promise<Token>,
            refreshAccessToken: mockRefreshAccessToken,
        }));
        // No expiry, so the timer treats the token as due on every tick.
        mockGetAccessToken.mockResolvedValue({ access_token: 'access-token-123' });
        mockParseToken.mockImplementation((token: string) => {
            if (token === BAD_TOKEN) throw new Error('Invalid token');
            return { tokenUserName: 'test-user', portalUrlResourceId: 'test-resource' };
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.resetAllMocks();
        vi.useRealTimers();
    });

    describe('initial token fetch', () => {
        it('calls getAccessToken with the parsed tokenUserName on mount', async () => {
            const { wrapper } = withSetup(uniqueToken());
            await Promise.resolve();

            expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
            expect(mockGetAccessToken).toHaveBeenCalledWith('test-user');
            wrapper.unmount();
        });

        it('sets accessToken.value from the response', async () => {
            const { auth, wrapper } = withSetup(uniqueToken());
            await Promise.resolve();

            expect(auth.accessToken.value).toBe('access-token-123');
            wrapper.unmount();
        });

        it('logs INVALID_TOKEN and leaves accessToken undefined when the fetch fails', async () => {
            const networkError = new Error('network failure');
            mockGetAccessToken.mockRejectedValueOnce(networkError);

            const { auth, wrapper } = withSetup(uniqueToken());
            await Promise.resolve();

            expect(auth.accessToken.value).toBeUndefined();
            expect(mockLogError).toHaveBeenCalledWith(
                'INVALID_TOKEN',
                'Failed to fetch access token',
                {},
                networkError,
            );
            wrapper.unmount();
        });
    });

    describe('singleton behaviour', () => {
        it('shares one token fetch across multiple components with the same token', async () => {
            const token = uniqueToken();
            const { auth: auth1, wrapper: w1 } = withSetup(token);
            const { auth: auth2, wrapper: w2 } = withSetup(token);

            await Promise.resolve();

            expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
            expect(auth1.accessToken.value).toBe('access-token-123');
            expect(auth2.accessToken.value).toBe('access-token-123');

            w1.unmount();
            w2.unmount();
        });

        it('creates independent state for different tokens', async () => {
            const { wrapper: w1 } = withSetup(uniqueToken());
            const { wrapper: w2 } = withSetup(uniqueToken());

            await Promise.resolve();

            expect(mockGetAccessToken).toHaveBeenCalledTimes(2);

            w1.unmount();
            w2.unmount();
        });
    });

    describe('refresh interval', () => {
        it('applies the refreshed access token', async () => {
            mockRefreshAccessToken.mockResolvedValue(tokenResponse(REFRESHED_TOKEN));

            const { auth, wrapper } = withSetup(uniqueToken());
            await vi.advanceTimersByTimeAsync(0);
            expect(auth.accessToken.value).toBe('access-token-123');

            await vi.advanceTimersByTimeAsync(30_000);

            expect(auth.accessToken.value).toBe(REFRESHED_TOKEN);
            wrapper.unmount();
        });

        it('reports SESSION_EXPIRED once it gives up refreshing', async () => {
            const unauthorized = { statusCode: 401, hasError: true };
            mockRefreshAccessToken.mockRejectedValue(unauthorized);

            const { wrapper } = withSetup(uniqueToken());

            await vi.advanceTimersByTimeAsync(30_000); // 401 #1 — still trying
            expect(mockLogError).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(30_000); // 401 #2 — gives up

            expect(mockLogError).toHaveBeenCalledWith(
                'SESSION_EXPIRED',
                'Stopped refreshing the access token after repeated 401 responses',
                {},
                unauthorized,
            );
            wrapper.unmount();
        });

        it('stops the interval after 2 consecutive 401 responses', async () => {
            mockRefreshAccessToken.mockRejectedValue({ statusCode: 401, hasError: true });

            const { wrapper } = withSetup(uniqueToken());

            await vi.advanceTimersByTimeAsync(30_000); // 1st tick → 401 #1
            await vi.advanceTimersByTimeAsync(30_000); // 2nd tick → 401 #2 → interval cleared
            await vi.advanceTimersByTimeAsync(30_000); // 3rd tick → should not fire

            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(2);
            wrapper.unmount();
        });

        it('resets the 401 counter after a successful refresh', async () => {
            mockRefreshAccessToken
                .mockRejectedValueOnce({ statusCode: 401, hasError: true }) // tick 1: counter → 1
                .mockResolvedValueOnce(tokenResponse(REFRESHED_TOKEN, 30)) //  tick 2: counter reset to 0
                .mockRejectedValueOnce({ statusCode: 401, hasError: true }) // tick 3: counter → 1 (not 2)
                .mockResolvedValue(tokenResponse(REFRESHED_TOKEN, 30)); //     tick 4+: running

            const { wrapper } = withSetup(uniqueToken());

            await vi.advanceTimersByTimeAsync(30_000);
            await vi.advanceTimersByTimeAsync(30_000);
            await vi.advanceTimersByTimeAsync(30_000);
            await vi.advanceTimersByTimeAsync(30_000);

            // All 4 ticks fired — interval was never stopped
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(4);
            wrapper.unmount();
        });

        it('does not stop the interval for non-401 errors', async () => {
            mockRefreshAccessToken.mockRejectedValue({ statusCode: 500, hasError: true });

            const { wrapper } = withSetup(uniqueToken());

            await vi.advanceTimersByTimeAsync(30_000);
            await vi.advanceTimersByTimeAsync(30_000);
            await vi.advanceTimersByTimeAsync(30_000);

            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(3);
            wrapper.unmount();
        });
    });

    describe('cleanup', () => {
        it('clears the interval when the last component unmounts', () => {
            const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

            const { wrapper } = withSetup(uniqueToken());
            wrapper.unmount();

            expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
            clearIntervalSpy.mockRestore();
        });

        it('keeps the interval running until the last component for the same token unmounts', () => {
            const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
            const token = uniqueToken();

            const { wrapper: w1 } = withSetup(token);
            const { wrapper: w2 } = withSetup(token);

            w1.unmount(); // refCount → 1, interval still alive
            expect(clearIntervalSpy).not.toHaveBeenCalled();

            w2.unmount(); // refCount → 0, interval cleared
            expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

            clearIntervalSpy.mockRestore();
        });
    });

    describe('malformed portal token', () => {
        it('logs INVALID_TOKEN and returns an auth without a token instead of throwing', async () => {
            const { auth, wrapper } = withSetup(BAD_TOKEN);
            await vi.advanceTimersByTimeAsync(0);

            expect(auth.accessToken.value).toBeUndefined();
            await expect(auth.getFreshAccessToken()).resolves.toBeUndefined();
            expect(mockGetAccessToken).not.toHaveBeenCalled();
            expect(mockLogError).toHaveBeenCalledWith(
                'INVALID_TOKEN',
                'Failed to parse the portal token',
                {},
                expect.any(Error),
            );
            wrapper.unmount();
        });

        it('leaves nothing behind, so every later mount reports it again', async () => {
            withSetup(BAD_TOKEN).wrapper.unmount();
            withSetup(BAD_TOKEN).wrapper.unmount();

            expect(
                mockLogError.mock.calls.filter(([code]) => code === 'INVALID_TOKEN'),
            ).toHaveLength(2);
        });
    });

    describe('expiry', () => {
        it('refreshes a token that is about to expire, judged by expires_in', async () => {
            mockGetAccessToken.mockResolvedValue(tokenResponse('access-token-123', 80));
            mockRefreshAccessToken.mockResolvedValue(tokenResponse(REFRESHED_TOKEN));

            const { auth, wrapper } = withSetup(uniqueToken());
            await vi.advanceTimersByTimeAsync(0);

            await vi.advanceTimersByTimeAsync(10_000);
            await expect(auth.getFreshAccessToken()).resolves.toBe('access-token-123');
            expect(mockRefreshAccessToken).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(20_000);
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            expect(auth.accessToken.value).toBe(REFRESHED_TOKEN);
            wrapper.unmount();
        });

        it('does not depend on an `exp` claim in the access token', async () => {
            const withoutExp = `${btoa('{"alg":"none"}')}.${btoa('{"sub":"x"}')}.`;
            mockGetAccessToken.mockResolvedValue(tokenResponse(withoutExp, 30));
            mockRefreshAccessToken.mockResolvedValue(tokenResponse(REFRESHED_TOKEN));

            const { auth, wrapper } = withSetup(uniqueToken());
            await vi.advanceTimersByTimeAsync(30_000);

            expect(auth.accessToken.value).toBe(REFRESHED_TOKEN);
            wrapper.unmount();
        });

        it('leaves a fresh token alone on a timer tick', async () => {
            mockGetAccessToken.mockResolvedValue(tokenResponse('access-token-123'));

            const { wrapper } = withSetup(uniqueToken());
            await vi.advanceTimersByTimeAsync(90_000);

            expect(mockRefreshAccessToken).not.toHaveBeenCalled();
            wrapper.unmount();
        });
    });

    describe('refresh before a request', () => {
        it('shares one refresh among every request that finds the token about to expire', async () => {
            mockGetAccessToken.mockResolvedValue(tokenResponse('access-token-123', 30));
            let resolveRefresh!: (token: Token) => void;
            mockRefreshAccessToken.mockReturnValue(
                new Promise((resolve) => (resolveRefresh = resolve)),
            );

            const { auth, wrapper } = withSetup(uniqueToken());
            await vi.advanceTimersByTimeAsync(0);

            const tokens = Promise.all([
                auth.getFreshAccessToken(),
                auth.getFreshAccessToken(),
                auth.renewAccessToken('access-token-123'),
            ]);
            resolveRefresh(tokenResponse(REFRESHED_TOKEN));

            await expect(tokens).resolves.toEqual([
                REFRESHED_TOKEN,
                REFRESHED_TOKEN,
                REFRESHED_TOKEN,
            ]);
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            wrapper.unmount();
        });

        it('hands a request rejected with an old token the one that replaced it', async () => {
            mockGetAccessToken.mockResolvedValue(tokenResponse('access-token-123', 30));
            mockRefreshAccessToken.mockResolvedValue(tokenResponse(REFRESHED_TOKEN));

            const { auth, wrapper } = withSetup(uniqueToken());
            await vi.advanceTimersByTimeAsync(0);

            await auth.renewAccessToken('access-token-123');
            await expect(auth.renewAccessToken('access-token-123')).resolves.toBe(REFRESHED_TOKEN);
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            wrapper.unmount();
        });

        it('fails the waiting requests cleanly and does not retry on every request', async () => {
            mockGetAccessToken.mockResolvedValue(tokenResponse('access-token-123'));
            mockRefreshAccessToken.mockRejectedValue({ statusCode: 500 });

            const { auth, wrapper } = withSetup(uniqueToken());
            await vi.advanceTimersByTimeAsync(0);

            await expect(
                Promise.all([
                    auth.renewAccessToken('access-token-123'),
                    auth.renewAccessToken('access-token-123'),
                ]),
            ).resolves.toEqual([undefined, undefined]);
            await expect(auth.renewAccessToken('access-token-123')).resolves.toBeUndefined();

            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            wrapper.unmount();
        });

        it('stops asking for a token once the session has expired', async () => {
            mockRefreshAccessToken.mockRejectedValue({ statusCode: 401 });

            const { auth, wrapper } = withSetup(uniqueToken());
            await vi.advanceTimersByTimeAsync(60_000);
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(2);

            await expect(auth.renewAccessToken('access-token-123')).resolves.toBeUndefined();
            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(2);
            wrapper.unmount();
        });
    });

    describe('tab becoming visible', () => {
        const becomeVisible = () => document.dispatchEvent(new Event('visibilitychange'));

        it('refreshes a token that expired while the tab was in the background', async () => {
            mockGetAccessToken.mockResolvedValue(tokenResponse('access-token-123', 120));
            mockRefreshAccessToken.mockResolvedValue(tokenResponse(REFRESHED_TOKEN));

            const { auth, wrapper } = withSetup(uniqueToken());
            await vi.advanceTimersByTimeAsync(0);

            // Throttled timers do not fire; the clock still moves.
            vi.setSystemTime(Date.now() + 10 * 60_000);
            becomeVisible();
            await vi.advanceTimersByTimeAsync(0);

            expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
            expect(auth.accessToken.value).toBe(REFRESHED_TOKEN);
            wrapper.unmount();
        });

        it('stops listening once the last element unmounts', async () => {
            const { wrapper } = withSetup(uniqueToken());
            await vi.advanceTimersByTimeAsync(0);
            wrapper.unmount();

            becomeVisible();
            await vi.advanceTimersByTimeAsync(0);

            expect(mockRefreshAccessToken).not.toHaveBeenCalled();
        });
    });

    describe('elements leaving the page', () => {
        it('reports to the elements still mounted, not to the first one', async () => {
            const firstLog = vi.fn();
            const secondLog = vi.fn();
            const secondRefresh = vi.fn().mockRejectedValue({ statusCode: 401 });
            vi.mocked(useLogger)
                .mockReturnValueOnce(createLogger(firstLog))
                .mockReturnValueOnce(createLogger(secondLog));
            vi.mocked(createTokensService)
                .mockReturnValueOnce({
                    getAccessToken: mockGetAccessToken as () => Promise<Token>,
                    refreshAccessToken: mockRefreshAccessToken,
                })
                .mockReturnValueOnce({
                    getAccessToken: mockGetAccessToken as () => Promise<Token>,
                    refreshAccessToken: secondRefresh,
                });

            const token = uniqueToken();
            const { wrapper: first } = withSetup(token);
            const { wrapper: second } = withSetup(token);
            await vi.advanceTimersByTimeAsync(0);
            first.unmount();

            await vi.advanceTimersByTimeAsync(60_000);

            expect(mockRefreshAccessToken).not.toHaveBeenCalled();
            expect(secondRefresh).toHaveBeenCalledTimes(2);
            expect(secondLog).toHaveBeenCalledWith(
                'SESSION_EXPIRED',
                expect.any(String),
                {},
                expect.anything(),
            );
            expect(firstLog).not.toHaveBeenCalled();
            second.unmount();
        });
    });
});
