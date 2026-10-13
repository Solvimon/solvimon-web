import { flushPromises } from '@vue/test-utils';
import { defineComponent, defineCustomElement, h, onMounted, ref, watch } from 'vue';
import type { Component } from 'vue';
import EntryProvider from './EntryProvider.vue';
import type { LogEntry } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

/**
 * The public contract seen from the host: a real custom element, its `log` and `error` events, and
 * `onLog`, with properties set the way a plain HTML integration sets them.
 */

vi.mock('@/components/providers/AuthProvider/AuthProvider.lib', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getAuth: () => ({
        accessToken: ref('access-token'),
        getFreshAccessToken: async () => 'access-token',
        renewAccessToken: async () => undefined,
    }),
}));

let tagCount = 0;

const ENTRY_PROPS: string[] = [
    'environment',
    'portalObject',
    'onLog',
    'logLevel',
    'locale',
    'cssOverrides',
    'configuration',
];

/** Defines a fresh element whose entry renders `child` inside the real provider tree. */
const defineEntryElement = (
    child: Component,
    required?: (props: Record<string, unknown>) => Record<string, unknown>,
) => {
    const tag = `solvimon-entry-${++tagCount}`;
    const Entry = defineComponent({
        props: ENTRY_PROPS,
        emits: ['error'],
        setup(props, { emit }) {
            return () =>
                h(
                    EntryProvider,
                    {
                        entry: props as never,
                        componentName: tag,
                        allowedPortalTypes: ['CUSTOMER'],
                        requiredConfiguration: required?.(props),
                        onError: (error: Error) => emit('error', error),
                    },
                    () => h(child),
                );
        },
    });
    customElements.define(tag, defineCustomElement(Entry));

    return tag;
};

interface Recorded {
    element: HTMLElement;
    logEvents: CustomEvent[];
    errorEvents: CustomEvent[];
}

const createElement = (tag: string): Recorded => {
    const element = document.createElement(tag);
    const recorded: Recorded = { element, logEvents: [], errorEvents: [] };
    element.addEventListener('log', (event) => recorded.logEvents.push(event as CustomEvent));
    element.addEventListener('error', (event) =>
        recorded.errorEvents.push(event as unknown as CustomEvent),
    );

    return recorded;
};

const settle = async () => {
    await flushPromises();
    await vi.dynamicImportSettled();
    await flushPromises();
};

const unhandled = (onLog: ReturnType<typeof vi.fn>) =>
    onLog.mock.calls
        .map(([entry]) => entry as LogEntry)
        .filter((e) => e.code === 'UNHANDLED_ERROR');

describe('EntryProvider inside a custom element', () => {
    let consoleError: ReturnType<typeof vi.spyOn>;
    let consoleWarn: ReturnType<typeof vi.spyOn>;
    let consoleInfo: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const mountWith = async (child: Component) => {
        const tag = defineEntryElement(child);
        const recorded = createElement(tag);
        const onLog = vi.fn();
        Object.assign(recorded.element, {
            environment: 'TEST',
            portalObject: createTestPortalObject(),
            onLog,
        });
        document.body.append(recorded.element);
        await settle();

        return { ...recorded, onLog };
    };

    const expectReportedOnce = (
        { onLog, errorEvents }: { onLog: ReturnType<typeof vi.fn>; errorEvents: CustomEvent[] },
        message: string,
    ) => {
        expect(unhandled(onLog)).toHaveLength(1);
        expect(errorEvents).toHaveLength(1);
        const [event] = errorEvents;
        expect(Array.isArray(event.detail)).toBe(true);
        expect(event.detail[0]).toBeInstanceOf(Error);
        expect(event.detail[0].message).toBe(message);
        expect(event.bubbles).toBe(false);
    };

    describe('every kind of unhandled failure reaches onLog and the error event exactly once', () => {
        it('in setup', async () => {
            const recorded = await mountWith(
                defineComponent({
                    setup() {
                        throw new Error('setup broke');
                    },
                }),
            );
            expectReportedOnce(recorded, 'setup broke');
        });

        it('in render', async () => {
            const recorded = await mountWith(
                defineComponent({
                    setup: () => () => {
                        throw new Error('render broke');
                    },
                }),
            );
            expectReportedOnce(recorded, 'render broke');
        });

        it('in a watcher', async () => {
            const trigger = ref(0);
            const recorded = await mountWith(
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
            await settle();
            expectReportedOnce(recorded, 'watcher broke');
        });

        it('in an async lifecycle hook', async () => {
            const recorded = await mountWith(
                defineComponent({
                    setup() {
                        onMounted(async () => {
                            await Promise.resolve();
                            throw new Error('hook broke');
                        });
                        return () => h('span');
                    },
                }),
            );
            await settle();
            expectReportedOnce(recorded, 'hook broke');
        });

        it('in an event handler', async () => {
            const recorded = await mountWith(
                defineComponent({
                    setup: () => () =>
                        h(
                            'button',
                            {
                                class: 'throwing-button',
                                onClick: () => {
                                    throw new Error('click broke');
                                },
                            },
                            'go',
                        ),
                }),
            );
            const button =
                recorded.element.shadowRoot?.querySelector<HTMLButtonElement>('.throwing-button');
            expect(button).toBeTruthy();
            button?.click();
            await settle();
            expectReportedOnce(recorded, 'click broke');
        });
    });

    it('carries no token in what it reports', async () => {
        const recorded = await mountWith(
            defineComponent({
                setup() {
                    throw new Error('setup broke');
                },
            }),
        );
        const token = String(createTestPortalObject().token);
        const [entry] = unhandled(recorded.onLog);
        const serialised = JSON.stringify({ ...entry, error: String(entry.error) });

        expect(token.length).toBeGreaterThan(0);
        expect(serialised).not.toContain(token);
    });

    it('dispatches `error` with an array detail, unlike `log`, whose detail is the entry itself', async () => {
        const recorded = await mountWith(
            defineComponent({
                setup() {
                    throw new Error('setup broke');
                },
            }),
        );

        const unhandledLog = recorded.logEvents.find(
            (event) => (event.detail as LogEntry).code === 'UNHANDLED_ERROR',
        );
        expect(unhandledLog?.detail).toMatchObject({ code: 'UNHANDLED_ERROR' });
        expect(Array.isArray(recorded.errorEvents[0].detail)).toBe(true);
    });

    it('dispatches a log entry written while the tree first sets up as a `log` event', async () => {
        const recorded = await mountWith(
            defineComponent({
                setup() {
                    useLogger().warn('MISSING_REQUIRED_PROPERTIES', 'first render');
                    return () => h('span');
                },
            }),
        );

        expect(recorded.logEvents.map((event) => (event.detail as LogEntry).message)).toContain(
            'first render',
        );
        expect(recorded.onLog).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'first render' }),
        );
    });

    it('reports an unknown environment, from a provider that sets up before the host is mounted, as a `log` and an `error` event', async () => {
        const recorded = createElement(
            defineEntryElement(defineComponent({ render: () => h('span') })),
        );
        const onLog = vi.fn();
        Object.assign(recorded.element, {
            environment: 'STAGING',
            portalObject: createTestPortalObject(),
            onLog,
        });
        document.body.append(recorded.element);
        await settle();

        const codes = recorded.logEvents.map((event) => (event.detail as LogEntry).code);
        expect(codes).toEqual(['UNHANDLED_ERROR']);
        expect(recorded.errorEvents).toHaveLength(1);
        expect(recorded.errorEvents[0].detail[0].message).toMatch(/Unknown Solvimon environment/);
    });

    it('has the css overrides in the shadow root by the time the tree below mounts', async () => {
        let adoptedWhenMounted = -1;
        let baseline = -1;
        const tag = defineEntryElement(
            defineComponent({
                setup() {
                    onMounted(() => {
                        const root = document.querySelector(tag)?.shadowRoot;
                        adoptedWhenMounted =
                            (root?.adoptedStyleSheets?.length ?? 0) +
                            (root?.querySelectorAll('style').length ?? 0);
                    });
                    return () => h('span');
                },
            }),
        );
        const plain = createElement(tag);
        Object.assign(plain.element, {
            environment: 'TEST',
            portalObject: createTestPortalObject(),
        });
        document.body.append(plain.element);
        await settle();
        const plainRoot = plain.element.shadowRoot;
        baseline =
            (plainRoot?.adoptedStyleSheets?.length ?? 0) +
            (plainRoot?.querySelectorAll('style').length ?? 0);
        plain.element.remove();

        const styled = createElement(tag);
        Object.assign(styled.element, {
            environment: 'TEST',
            portalObject: createTestPortalObject(),
            cssOverrides: '.x { color: red; }',
        });
        document.body.append(styled.element);
        await settle();

        expect(adoptedWhenMounted).toBe(baseline + 1);
    });

    it('keeps reporting when the host onLog throws, and still writes to the console', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout'] });
        const tag = defineEntryElement(
            defineComponent({
                setup() {
                    throw new Error('setup broke');
                },
            }),
        );
        const recorded = createElement(tag);
        const onLog = vi.fn(() => {
            throw new Error('host onLog broke');
        });
        Object.assign(recorded.element, {
            environment: 'TEST',
            portalObject: createTestPortalObject(),
            onLog,
        });
        document.body.append(recorded.element);
        await settle();

        expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNHANDLED_ERROR' }));
        expect(recorded.errorEvents).toHaveLength(1);
        expect(recorded.logEvents.length).toBeGreaterThan(0);
        expect(consoleError).toHaveBeenCalledWith(
            expect.stringContaining('UNHANDLED_ERROR'),
            expect.anything(),
            expect.anything(),
        );
        // Rethrown on a timer, once per throwing call, and nothing it throws is logged again.
        const callsBefore = onLog.mock.calls.length;
        expect(() => vi.runOnlyPendingTimers()).toThrow('host onLog broke');
        expect(onLog.mock.calls.length).toBe(callsBefore);
    });

    it('dispatches on the inner element, not the outer one, when SDK elements are nested', async () => {
        const innerTag = defineEntryElement(
            defineComponent({
                setup() {
                    throw new Error('inner broke');
                },
            }),
        );
        const outerRecorded = await mountWith(
            defineComponent({
                setup: () => () =>
                    h(innerTag, {
                        environment: 'TEST',
                        portalObject: createTestPortalObject(),
                    }),
            }),
        );
        await settle();
        const inner = outerRecorded.element.shadowRoot?.querySelector(innerTag);

        expect(inner).toBeTruthy();
        expect(outerRecorded.errorEvents).toHaveLength(0);
        expect(unhandled(outerRecorded.onLog)).toHaveLength(0);
        // The inner element's `log` event bubbles and is composed, so the outer host hears it as a
        // `log` event too; that is the event's design, not a second report.
        const innerEntries = outerRecorded.logEvents
            .map((event) => event.detail as LogEntry)
            .filter((entry) => entry.code === 'UNHANDLED_ERROR');
        expect(innerEntries).toHaveLength(1);
    });

    describe('properties set after the element is connected, as plain HTML does', () => {
        const Content = defineComponent({
            setup: () => () => h('p', { class: 'entry-content' }, 'content'),
        });

        it('renders once they are set in the same task, without a warning', async () => {
            vi.useFakeTimers({ toFake: ['setTimeout'] });
            const recorded = createElement(defineEntryElement(Content));
            document.body.append(recorded.element);
            Object.assign(recorded.element, {
                environment: 'TEST',
                portalObject: createTestPortalObject(),
            });
            await settle();
            vi.runOnlyPendingTimers();
            await settle();

            expect(recorded.element.shadowRoot?.querySelector('.entry-content')).toBeTruthy();
            expect(
                recorded.logEvents.map((event) => (event.detail as LogEntry).code),
            ).not.toContain('MISSING_REQUIRED_PROPERTIES');
        });

        it('warns once when nothing is set, and renders when they arrive later', async () => {
            vi.useFakeTimers({ toFake: ['setTimeout'] });
            const recorded = createElement(defineEntryElement(Content));
            document.body.append(recorded.element);
            vi.runOnlyPendingTimers();
            vi.runOnlyPendingTimers();

            const warnings = recorded.logEvents.filter(
                (event) => (event.detail as LogEntry).code === 'MISSING_REQUIRED_PROPERTIES',
            );
            expect(warnings).toHaveLength(1);
            expect((warnings[0].detail as LogEntry).context?.missing).toEqual([
                'environment',
                'portalObject',
            ]);
            expect(recorded.element.shadowRoot?.querySelector('.entry-content')).toBeNull();

            Object.assign(recorded.element, {
                environment: 'TEST',
                portalObject: createTestPortalObject(),
            });
            await settle();

            expect(recorded.element.shadowRoot?.querySelector('.entry-content')).toBeTruthy();
        });

        it('calls an onLog set after the element was connected', async () => {
            const recorded = createElement(
                defineEntryElement(
                    defineComponent({
                        setup() {
                            throw new Error('setup broke');
                        },
                    }),
                ),
            );
            const onLog = vi.fn();
            document.body.append(recorded.element);
            Object.assign(recorded.element, {
                environment: 'TEST',
                portalObject: createTestPortalObject(),
                onLog,
            });
            await settle();

            expect(recorded.errorEvents).toHaveLength(1);
            expect(onLog).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'UNHANDLED_ERROR' }),
            );
        });

        it('keeps a LIVE element out of the console when environment is set after connecting', async () => {
            const recorded = createElement(
                defineEntryElement(
                    defineComponent({
                        setup() {
                            throw new Error('setup broke');
                        },
                    }),
                ),
            );
            document.body.append(recorded.element);
            Object.assign(recorded.element, {
                environment: 'LIVE',
                portalObject: createTestPortalObject(),
            });
            await settle();

            const [entry] = recorded.logEvents
                .map((event) => event.detail as LogEntry)
                .filter((e) => e.code === 'UNHANDLED_ERROR');
            expect(entry).toBeDefined();
            // Only the SDK's own output: Vue's development build also warns about the required
            // props the element mounted without, which the published build does not.
            const sdkOutput = [consoleError, consoleWarn, consoleInfo]
                .flatMap((spy) => spy.mock.calls)
                .filter(([first]) => String(first).startsWith('[solvimon]'));
            expect(sdkOutput).toEqual([]);
        });

        it('unmounts the tree when a required property is unset again, and remounts it when restored', async () => {
            let setups = 0;
            const recorded = await mountWith(
                defineComponent({
                    setup() {
                        setups++;
                        return () => h('p', { class: 'entry-content' }, 'content');
                    },
                }),
            );
            expect(setups).toBe(1);

            Object.assign(recorded.element, { portalObject: undefined });
            await settle();
            expect(recorded.element.shadowRoot?.querySelector('.entry-content')).toBeNull();

            Object.assign(recorded.element, { portalObject: createTestPortalObject() });
            await settle();
            expect(recorded.element.shadowRoot?.querySelector('.entry-content')).toBeTruthy();
            expect(setups).toBe(2);
        });
    });
});
