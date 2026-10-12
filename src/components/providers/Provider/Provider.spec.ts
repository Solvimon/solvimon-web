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

        expect(mockGetAuth).toHaveBeenLastCalledWith('other-token');
        expect(wrapper.find('.probe').text()).toBe('TEST|cus_2|false');
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
});
