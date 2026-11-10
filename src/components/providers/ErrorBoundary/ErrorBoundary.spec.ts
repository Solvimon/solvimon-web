import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref, watch } from 'vue';
import { useErrorHandling } from '@solvimon/solvimon-ui';
import ErrorBoundary from './ErrorBoundary.vue';
import { HOST_ELEMENT_PROVIDER_INJECTION_KEY } from '@/components/providers/HostElementProvider/HostElementProvider.lib';
import { LOGGER_PROVIDER_INJECTION_KEY } from '@/components/providers/LoggerProvider/LoggerProvider.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { CodedError } from '@/utils/error';

const createLogger = (): Logger => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    capture: vi.fn(),
});

/** Mounts the boundary into a host element, recording the `solvimon-error` events dispatched on it. */
const mountBoundary = (child: ReturnType<typeof defineComponent>) => {
    const logger = createLogger();
    const host = document.createElement('div');
    const events: CustomEvent[] = [];
    host.addEventListener('solvimon-error', (event) => events.push(event as CustomEvent));
    const wrapper = mount(ErrorBoundary, {
        slots: { default: () => h(child) },
        global: {
            provide: {
                [LOGGER_PROVIDER_INJECTION_KEY as symbol]: logger,
                [HOST_ELEMENT_PROVIDER_INJECTION_KEY as symbol]: {
                    hostRef: ref(host),
                    customElementName: 'solvimon-test',
                },
            },
        },
    });
    const errors = () => events.map((event) => (event.detail as { error: unknown }).error);

    return { wrapper, logger, events, errors };
};

describe('ErrorBoundary', () => {
    it('captures an error thrown while a component below sets up', () => {
        const failure = new Error('setup broke');
        const { logger, errors } = mountBoundary(
            defineComponent({
                setup() {
                    throw failure;
                },
            }),
        );

        expect(logger.capture).toHaveBeenCalledWith(failure, expect.any(Object));
        expect(errors()).toEqual([failure]);
    });

    it('reports an error that names its own code under that code, once', () => {
        const failure = new CodedError('INVALID_TOKEN', 'Invalid token');
        const { logger, errors } = mountBoundary(
            defineComponent({
                setup() {
                    throw failure;
                },
            }),
        );

        expect(logger.capture).toHaveBeenCalledOnce();
        expect(logger.capture).toHaveBeenCalledWith(
            failure,
            expect.objectContaining({ code: 'INVALID_TOKEN', message: 'Invalid token' }),
        );
        expect(errors()).toEqual([failure]);
    });

    it('keeps the context a coded error carries on its log entry', () => {
        const failure = new CodedError('PORTAL_TYPE_NOT_ALLOWED', 'Wrong portal', {
            portalUrlId: 'pu_1',
        });
        const { logger } = mountBoundary(
            defineComponent({
                setup() {
                    throw failure;
                },
            }),
        );

        expect(logger.capture).toHaveBeenCalledWith(
            failure,
            expect.objectContaining({
                code: 'PORTAL_TYPE_NOT_ALLOWED',
                message: 'Wrong portal',
                portalUrlId: 'pu_1',
            }),
        );
    });

    it('captures an error thrown while rendering', () => {
        const { logger, errors } = mountBoundary(
            defineComponent({
                setup: () => () => {
                    throw new Error('render broke');
                },
            }),
        );

        expect(logger.capture).toHaveBeenCalledOnce();
        expect(errors()).toHaveLength(1);
    });

    it('captures an error thrown by a watcher', async () => {
        const trigger = ref(0);
        const { errors } = mountBoundary(
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

        expect(errors()).toHaveLength(1);
    });

    it('captures a rejection from an async lifecycle hook', async () => {
        const { errors } = mountBoundary(
            defineComponent({
                async mounted() {
                    await Promise.resolve();
                    throw new Error('load broke');
                },
                render: () => h('span'),
            }),
        );
        await flushPromises();

        expect(errors()).toHaveLength(1);
    });

    it('logs what the UI library recovered from as a warning, without the error event', () => {
        const recovered = new Error('Failed to format date');
        const { logger, errors } = mountBoundary(
            defineComponent({
                setup() {
                    useErrorHandling().onError?.(recovered);
                    return () => h('span');
                },
            }),
        );

        expect(logger.warn).toHaveBeenCalledWith(
            'UI_COMPONENT_RECOVERED',
            expect.any(String),
            {},
            recovered,
        );
        expect(logger.capture).not.toHaveBeenCalled();
        expect(errors()).toEqual([]);
    });

    it('dispatches an Error even when something else was thrown, keeping it as the cause', () => {
        const { errors } = mountBoundary(
            defineComponent({
                setup() {
                    throw 'a string';
                },
            }),
        );

        const [emitted] = errors() as Error[];
        expect(emitted).toBeInstanceOf(Error);
        expect(emitted?.cause).toBe('a string');
    });

    it('dispatches solvimon-error as every SDK event, with the error, its code, element and reference', () => {
        const failure = new Error('setup broke');
        const { events } = mountBoundary(
            defineComponent({
                setup() {
                    throw failure;
                },
            }),
        );

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            bubbles: true,
            composed: true,
            detail: { error: failure, code: 'UNHANDLED_ERROR', componentName: 'solvimon-test' },
        });
        expect(events[0].detail.reference).toEqual(expect.any(String));
    });
});
