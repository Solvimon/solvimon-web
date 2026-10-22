import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import Provider from './Provider.vue';
import type { ProviderProps } from './Provider.types';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';
import { useExperimentalFeature } from '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

const { mockGetAuth } = vi.hoisted(() => ({ mockGetAuth: vi.fn() }));

vi.mock('@/components/providers/AuthProvider/AuthProvider.lib', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getAuth: mockGetAuth,
}));

const Probe = defineComponent({
    setup() {
        const config = useConfig();
        const portal = usePortal();
        const features = useExperimentalFeature();

        return () =>
            h('p', { class: 'probe' }, [
                `${config.environment}|${portal.value.customer_id}|`,
                `${features?.value['express-checkout']}`,
            ]);
    },
});

const HOST_TOKEN = {
    issued_at: '2026-10-22T10:00:00.000Z',
    access_token: 'host-token',
    access_token_expires_in: 3600,
    access_token_expires_at: '2026-10-22T11:00:00.000Z',
    token_type: 'bearer',
} as const;

const props = (overrides: Partial<ProviderProps> = {}): ProviderProps => ({
    customElementName: 'solvimon-test',
    environment: 'TEST',
    locale: 'en-US',
    portalObject: createTestPortalObject('cus_1'),
    allowedPortalTypes: ['CUSTOMER'],
    ...overrides,
});

/** The translation catalogue is a dynamic import, and the tree below waits for it. */
const settle = async () => {
    await flushPromises();
    await vi.dynamicImportSettled();
    await flushPromises();
};

const mountProvider = async (initial: Partial<ProviderProps> = {}) => {
    const wrapper = mount(Provider, {
        props: props(initial),
        slots: { default: () => h(Probe) },
    });
    await settle();

    return wrapper;
};

describe('Provider', () => {
    beforeEach(() => {
        mockGetAuth.mockImplementation(() => ({ accessToken: ref('access-token') }));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders the tree with what it was mounted with', async () => {
        const wrapper = await mountProvider();

        expect(wrapper.find('.probe').text()).toBe('TEST|cus_1|false');
    });

    it('starts a new session for a portal object with another token', async () => {
        const wrapper = await mountProvider();

        await wrapper.setProps(
            props({ portalObject: { ...createTestPortalObject('cus_2'), token: 'other-token' } }),
        );
        await settle();

        expect(mockGetAuth).toHaveBeenLastCalledWith('other-token', 'IDENTITY_TOKEN', undefined);
        expect(wrapper.find('.probe').text()).toBe('TEST|cus_2|false');
    });

    it('signs in with the handle of a portal object that authenticates with a signed token', async () => {
        await mountProvider({
            portalObject: {
                ...createTestPortalObject('cus_1'),
                token: 'cHVybF8x.handle',
                authentication: 'SIGNED_TOKEN',
            } as ProviderProps['portalObject'],
        });

        expect(mockGetAuth).toHaveBeenLastCalledWith('cHVybF8x.handle', 'SIGNED_TOKEN', undefined);
    });

    it('signs in again when the host says the same token is a handle', async () => {
        const wrapper = await mountProvider({
            portalObject: { ...createTestPortalObject('cus_1'), token: 'cHVybF8x.handle' },
        });

        await wrapper.setProps(
            props({
                portalObject: {
                    ...createTestPortalObject('cus_1'),
                    token: 'cHVybF8x.handle',
                    authentication: 'SIGNED_TOKEN',
                } as ProviderProps['portalObject'],
            }),
        );
        await settle();

        expect(mockGetAuth).toHaveBeenLastCalledWith('cHVybF8x.handle', 'SIGNED_TOKEN', undefined);
    });

    it('hands the session a token the host already exchanged the handle for', async () => {
        await mountProvider({
            portalObject: {
                ...createTestPortalObject('cus_1'),
                token: 'cHVybF8x.handle',
                authentication: 'SIGNED_TOKEN',
            } as ProviderProps['portalObject'],
            portalToken: HOST_TOKEN,
        });

        expect(mockGetAuth).toHaveBeenLastCalledWith('cHVybF8x.handle', 'SIGNED_TOKEN', HOST_TOKEN);
    });

    it('shows the unavailable notice in place of the tree once the link has ended', async () => {
        mockGetAuth.mockImplementation(() => ({
            accessToken: ref(undefined),
            status: ref({ state: 'ended', reason: 'expired' }),
        }));
        const wrapper = mount(Provider, {
            props: props(),
            slots: {
                default: () => h(Probe),
                'portal-unavailable': () => h('p', { class: 'ended' }, 'ended'),
            },
        });
        await settle();

        expect(wrapper.find('.probe').exists()).toBe(false);
        expect(wrapper.find('.ended').exists()).toBe(true);
    });

    it('follows an environment the host changes after mount', async () => {
        const wrapper = await mountProvider();

        await wrapper.setProps(props({ environment: 'LIVE' }));
        await settle();

        expect(wrapper.find('.probe').text()).toBe('LIVE|cus_1|false');
    });

    it('follows experimental features the host changes after mount', async () => {
        const wrapper = await mountProvider();

        await wrapper.setProps(props({ experimentalFeatures: ['express-checkout'] }));
        await settle();

        expect(wrapper.find('.probe').text()).toBe('TEST|cus_1|true');
    });

    it.each<[string, Partial<ProviderProps>]>([
        ['revoked', { portalObject: { ...createTestPortalObject(), status: 'REVOKED' } }],
        [
            'of a type the element does not accept',
            { allowedPortalTypes: ['INIT_PRICING_PLAN_SUBSCRIPTION'] },
        ],
    ])('does not exchange the token of a portal that is %s', async (_, overrides) => {
        const wrapper = await mountProvider(overrides);

        expect(mockGetAuth).not.toHaveBeenCalled();
        expect(wrapper.find('.probe').exists()).toBe(false);
    });
});
