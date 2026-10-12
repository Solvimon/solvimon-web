import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { getPortal } from './PortalProvider.lib';

const { mockGetPortalUrl, mockLogError } = vi.hoisted(() => ({
    mockGetPortalUrl: vi.fn(),
    mockLogError: vi.fn(),
}));

vi.mock('@/services/portals', () => ({
    createPortalsService: () => ({ getPortalUrl: mockGetPortalUrl }),
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

function withSetup(token: string) {
    let portal!: ReturnType<typeof getPortal>;
    const wrapper = mount(
        defineComponent({
            setup() {
                portal = getPortal({ token });
                return {};
            },
            template: '<div />',
        }),
    );
    return { portal, wrapper };
}

describe('getPortal', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('logs INVALID_TOKEN for a malformed token instead of throwing', async () => {
        const { portal, wrapper } = withSetup('%%% not base64 %%%');
        await Promise.resolve();

        expect(portal.value).toBeUndefined();
        expect(mockGetPortalUrl).not.toHaveBeenCalled();
        expect(mockLogError).toHaveBeenCalledWith(
            'INVALID_TOKEN',
            'Failed to parse the portal token',
            {},
            expect.any(Error),
        );
        wrapper.unmount();
    });

    it('loads the portal url the token names', async () => {
        mockGetPortalUrl.mockResolvedValue({ status: 'PUBLISHED', type: 'CUSTOMER' });

        const { portal, wrapper } = withSetup(btoa('portal-user.purl_123'));
        await vi.waitFor(() => expect(portal.value).toBeDefined());

        expect(mockGetPortalUrl).toHaveBeenCalledWith('purl_123');
        expect(mockLogError).not.toHaveBeenCalled();
        wrapper.unmount();
    });
});
