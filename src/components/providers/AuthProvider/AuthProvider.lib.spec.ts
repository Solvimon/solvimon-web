import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { getAuth } from './AuthProvider.lib';

const { mockGetAccessToken, mockRefreshAccessToken, mockLogError } = vi.hoisted(() => ({
    mockGetAccessToken: vi.fn().mockResolvedValue({ access_token: 'access-token-123' }),
    mockRefreshAccessToken: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    mockLogError: vi.fn(),
}));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({
        error: mockLogError,
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        capture: vi.fn(),
    }),
}));

vi.mock('@/services/tokens', () => ({
    createTokensService: () => ({
        getAccessToken: mockGetAccessToken,
        refreshAccessToken: mockRefreshAccessToken,
    }),
}));

vi.mock('@/utils/token', () => ({
    parseToken: () => ({ tokenUserName: 'test-user', portalUrlResourceId: 'test-resource' }),
}));

vi.mock('@/utils/accessToken', () => ({
    getAccessTokenParsed: vi.fn().mockReturnValue(undefined),
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
    });

    afterEach(() => {
        vi.clearAllMocks();
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
                .mockResolvedValueOnce(undefined) //                           tick 2: counter reset to 0
                .mockRejectedValueOnce({ statusCode: 401, hasError: true }) // tick 3: counter → 1 (not 2)
                .mockResolvedValue(undefined); //                              tick 4+: running

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
});
