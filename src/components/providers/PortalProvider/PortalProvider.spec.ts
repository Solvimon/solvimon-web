import { mount } from '@vue/test-utils';
import { defineComponent, h, onErrorCaptured, type PropType } from 'vue';
import type { PortalUrl } from '@solvimon/solvimon-types';
import PortalProvider from './PortalProvider.vue';
import { usePortal } from './composables/usePortal';
import { LOGGER_PROVIDER_INJECTION_KEY } from '@/components/providers/LoggerProvider/LoggerProvider.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';
import { CodedError } from '@/utils/error';

const PortalId = defineComponent({
    setup() {
        const portal = usePortal();
        return () => h('p', { class: 'content' }, portal.value.customer_id);
    },
});

const mountPortalProvider = (
    portalObject: PortalUrl,
    allowedPortalTypes: PortalUrl['type'][] = ['CUSTOMER'],
) => {
    const logger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        capture: vi.fn(),
    };
    const errorHandler = vi.fn();

    // Stands in for the error boundary above PortalProvider in every element.
    const Host = defineComponent({
        props: {
            portalObject: { type: Object as PropType<PortalUrl>, required: true },
            allowedPortalTypes: { type: Array as PropType<PortalUrl['type'][]>, required: true },
        },
        setup(hostProps) {
            onErrorCaptured((err) => {
                errorHandler(err);
                return false;
            });
            return () =>
                h(
                    PortalProvider,
                    {
                        portalObject: hostProps.portalObject,
                        allowedPortalTypes: hostProps.allowedPortalTypes,
                    },
                    {
                        default: () => h(PortalId),
                        unavailable: () => h('p', { class: 'unavailable' }, 'unavailable'),
                    },
                );
        },
    });

    const wrapper = mount(Host, {
        props: { portalObject, allowedPortalTypes },
        global: { provide: { [LOGGER_PROVIDER_INJECTION_KEY]: logger } },
    });

    return { wrapper, logger, errorHandler };
};

describe('PortalProvider', () => {
    it('renders for a published portal of an allowed type', () => {
        const { wrapper, logger } = mountPortalProvider(createTestPortalObject('cus_1'));

        expect(wrapper.find('.content').text()).toBe('cus_1');
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('renders nothing for a portal type the element does not accept, and fails the element', () => {
        const { wrapper, errorHandler } = mountPortalProvider(createTestPortalObject(), [
            'INIT_PRICING_PLAN_SUBSCRIPTION',
        ]);

        expect(wrapper.find('.content').exists()).toBe(false);
        expect(wrapper.find('.unavailable').exists()).toBe(false);
        expect(errorHandler).toHaveBeenCalledOnce();
        const [error] = errorHandler.mock.calls[0];
        expect(error).toBeInstanceOf(CodedError);
        expect(error).toMatchObject({
            code: 'PORTAL_TYPE_NOT_ALLOWED',
            message: expect.stringContaining('CUSTOMER'),
            context: expect.objectContaining({
                allowedPortalTypes: ['INIT_PRICING_PLAN_SUBSCRIPTION'],
            }),
        });
    });

    it('renders what the entry shows for an unavailable portal when it was revoked', () => {
        const { wrapper, logger } = mountPortalProvider({
            ...createTestPortalObject(),
            status: 'REVOKED',
        });

        expect(wrapper.find('.content').exists()).toBe(false);
        expect(wrapper.find('.unavailable').exists()).toBe(true);
        expect(logger.error).toHaveBeenCalledWith(
            'RESOURCE_REVOKED',
            expect.any(String),
            expect.objectContaining({ status: 'REVOKED' }),
        );
    });

    it('hands the tree below a portal object the host replaces after mount', async () => {
        const { wrapper } = mountPortalProvider(createTestPortalObject('cus_1'));

        await wrapper.setProps({ portalObject: createTestPortalObject('cus_2') });

        expect(wrapper.find('.content').text()).toBe('cus_2');
    });

    it('stops rendering when the replacement is revoked', async () => {
        const { wrapper, logger } = mountPortalProvider(createTestPortalObject());

        await wrapper.setProps({
            portalObject: { ...createTestPortalObject(), status: 'REVOKED' },
        });

        expect(wrapper.find('.content').exists()).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
            'RESOURCE_REVOKED',
            expect.any(String),
            expect.any(Object),
        );
    });
});
