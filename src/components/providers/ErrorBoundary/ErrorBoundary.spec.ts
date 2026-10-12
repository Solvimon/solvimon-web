import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref, watch } from 'vue';
import ErrorBoundary from './ErrorBoundary.vue';
import { LOGGER_PROVIDER_INJECTION_KEY } from '@/components/providers/LoggerProvider/LoggerProvider.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';

const createLogger = (): Logger => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    capture: vi.fn(),
});

const mountBoundary = (child: ReturnType<typeof defineComponent>) => {
    const logger = createLogger();
    const wrapper = mount(ErrorBoundary, {
        slots: { default: () => h(child) },
        global: { provide: { [LOGGER_PROVIDER_INJECTION_KEY as symbol]: logger } },
    });

    return { wrapper, logger };
};

describe('ErrorBoundary', () => {
    it('captures an error thrown while a component below sets up', () => {
        const failure = new Error('setup broke');
        const { wrapper, logger } = mountBoundary(
            defineComponent({
                setup() {
                    throw failure;
                },
            }),
        );

        expect(logger.capture).toHaveBeenCalledWith(failure, expect.any(Object));
        expect(wrapper.emitted('error')).toEqual([[failure]]);
    });

    it('captures an error thrown while rendering', () => {
        const { wrapper, logger } = mountBoundary(
            defineComponent({
                setup: () => () => {
                    throw new Error('render broke');
                },
            }),
        );

        expect(logger.capture).toHaveBeenCalledOnce();
        expect(wrapper.emitted('error')).toHaveLength(1);
    });

    it('captures an error thrown by a watcher', async () => {
        const trigger = ref(0);
        const { wrapper } = mountBoundary(
            defineComponent({
                setup() {
                    watch(trigger, () => {
                        throw new Error('watcher broke');
                    });
                    return () => h('span');
                },
            }),
        );

        trigger.value++;
        await nextTick();

        expect(wrapper.emitted('error')).toHaveLength(1);
    });

    it('captures a rejection from an async lifecycle hook', async () => {
        const { wrapper } = mountBoundary(
            defineComponent({
                async mounted() {
                    await Promise.resolve();
                    throw new Error('load broke');
                },
                render: () => h('span'),
            }),
        );
        await flushPromises();

        expect(wrapper.emitted('error')).toHaveLength(1);
    });

    it('emits an Error even when something else was thrown, keeping it as the cause', () => {
        const { wrapper } = mountBoundary(
            defineComponent({
                setup() {
                    throw 'a string';
                },
            }),
        );

        const [[emitted]] = wrapper.emitted<[Error]>('error') ?? [[]];
        expect(emitted).toBeInstanceOf(Error);
        expect(emitted?.cause).toBe('a string');
    });
});
