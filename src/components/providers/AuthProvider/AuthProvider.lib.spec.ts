import { defineComponent, h, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { JWT } from '@solvimon/solvimon-types';
import { getAuth } from './AuthProvider.lib';
import { trackSentryException } from '@/utils/errorTracking';
import { getAccessTokenParsed } from '@/utils/accessToken';

const mockGetAccessToken = vi.fn();
const mockRefreshAccessToken = vi.fn();

vi.mock('@/services/tokens', () => ({
    createTokensService: vi.fn(() => ({
        getAccessToken: mockGetAccessToken,
        refreshAccessToken: mockRefreshAccessToken,
    })),
}));

vi.mock('@/utils/token', () => ({
    parseToken: vi.fn(() => ({ tokenUserName: 'test-user' })),
}));

vi.mock('@/utils/accessToken', () => ({
    getAccessTokenParsed: vi.fn(),
}));

vi.mock('@/utils/errorTracking', () => ({
    trackSentryException: vi.fn(),
}));

const makeWrapper = (token: string) =>
    defineComponent({
        setup() {
            return getAuth(token);
        },
        render: () => h('div'),
    });

describe('getAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('fetches and exposes the access token on mount', async () => {
        mockGetAccessToken.mockResolvedValue({ access_token: 'token-abc' });

        const wrapper = mount(makeWrapper('token-fetch'));
        await flushPromises();

        expect(wrapper.vm.accessToken).toBe('token-abc');
        wrapper.unmount();
    });

    it('two providers with the same token share one fetch and one interval', async () => {
        mockGetAccessToken.mockResolvedValue({ access_token: 'shared' });

        const wrapper1 = mount(makeWrapper('token-shared'));
        const wrapper2 = mount(makeWrapper('token-shared'));
        await flushPromises();

        expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
        expect(wrapper1.vm.accessToken).toBe('shared');
        expect(wrapper2.vm.accessToken).toBe('shared');

        wrapper1.unmount();
        wrapper2.unmount();
    });

    it('creates separate instances for different tokens', async () => {
        mockGetAccessToken.mockResolvedValue({ access_token: 'some-token' });

        const wrapper1 = mount(makeWrapper('token-a'));
        const wrapper2 = mount(makeWrapper('token-b'));
        await flushPromises();

        expect(mockGetAccessToken).toHaveBeenCalledTimes(2);

        wrapper1.unmount();
        wrapper2.unmount();
    });

    it('starts fresh when all providers for a token have unmounted and a new one mounts', async () => {
        mockGetAccessToken.mockResolvedValue({ access_token: 'val' });

        const wrapper1 = mount(makeWrapper('token-remount'));
        await flushPromises();
        expect(mockGetAccessToken).toHaveBeenCalledTimes(1);

        wrapper1.unmount();

        const wrapper2 = mount(makeWrapper('token-remount'));
        await flushPromises();
        expect(mockGetAccessToken).toHaveBeenCalledTimes(2);

        wrapper2.unmount();
    });

    it('calls trackSentryException and leaves accessToken undefined when fetch fails', async () => {
        mockGetAccessToken.mockRejectedValue(new Error('Unauthorized'));

        const wrapper = mount(makeWrapper('token-error'));
        await flushPromises();

        expect(trackSentryException).toHaveBeenCalledTimes(1);
        expect(wrapper.vm.accessToken).toBeUndefined();

        wrapper.unmount();
    });

    it('calls refreshAccessToken when the token is within 60 seconds of expiry', async () => {
        mockGetAccessToken.mockResolvedValue({ access_token: 'expiring-token' });
        vi.mocked(getAccessTokenParsed).mockReturnValue({ exp: Date.now() / 1000 + 30 } as JWT);

        const wrapper = mount(makeWrapper('token-expiry'));
        await flushPromises();

        vi.advanceTimersByTime(30 * 1000);

        expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);

        wrapper.unmount();
    });

    it('does not call refreshAccessToken when token has more than 60 seconds remaining', async () => {
        mockGetAccessToken.mockResolvedValue({ access_token: 'fresh-token' });
        vi.mocked(getAccessTokenParsed).mockReturnValue({ exp: Date.now() / 1000 + 300 } as JWT);

        const wrapper = mount(makeWrapper('token-fresh'));
        await flushPromises();

        vi.advanceTimersByTime(30 * 1000);

        expect(mockRefreshAccessToken).not.toHaveBeenCalled();

        wrapper.unmount();
    });

    it('stops the refresh interval when the last provider unmounts', async () => {
        mockGetAccessToken.mockResolvedValue({ access_token: 'cleanup-token' });
        vi.mocked(getAccessTokenParsed).mockReturnValue({ exp: Date.now() / 1000 + 30 } as JWT);

        const wrapper = mount(makeWrapper('token-cleanup'));
        await flushPromises();

        wrapper.unmount();

        // Interval should be cleared — advancing time must not trigger a refresh
        await nextTick();
        vi.advanceTimersByTime(30 * 1000);

        expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });
});
