import { mount } from '@vue/test-utils';
import { h } from 'vue';
import RequiredPropertiesGuard from './RequiredPropertiesGuard.vue';
import { LOGGER_PROVIDER_INJECTION_KEY } from '@/components/providers/LoggerProvider/LoggerProvider.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';

const mountGuard = (missing: string[]) => {
    const logger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        capture: vi.fn(),
    };
    const wrapper = mount(RequiredPropertiesGuard, {
        props: { missing },
        slots: { default: () => h('p', 'content') },
        global: { provide: { [LOGGER_PROVIDER_INJECTION_KEY as symbol]: logger } },
    });

    return { wrapper, logger };
};

describe('RequiredPropertiesGuard', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders its slot when nothing is missing, and reports nothing', () => {
        const { wrapper, logger } = mountGuard([]);
        vi.runAllTimers();

        expect(wrapper.text()).toBe('content');
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('holds its slot back and names what is missing', () => {
        const { wrapper, logger } = mountGuard(['portalObject']);

        expect(wrapper.text()).toBe('');
        expect(logger.warn).not.toHaveBeenCalled();

        vi.runAllTimers();

        expect(logger.warn).toHaveBeenCalledWith(
            'MISSING_REQUIRED_PROPERTIES',
            expect.stringContaining('portalObject'),
            { missing: ['portalObject'] },
        );
    });

    it('stays quiet when the properties arrive before the report is due', async () => {
        const { wrapper, logger } = mountGuard(['portalObject']);

        await wrapper.setProps({ missing: [] });
        vi.runAllTimers();

        expect(wrapper.text()).toBe('content');
        expect(logger.warn).not.toHaveBeenCalled();
    });
});
