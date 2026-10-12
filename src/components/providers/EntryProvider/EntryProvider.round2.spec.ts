import { flushPromises } from '@vue/test-utils';
import { defineComponent, defineCustomElement, h, ref } from 'vue';
import type { Component } from 'vue';
import EntryProvider from './EntryProvider.vue';
import type { LogEntry } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import BillingInformationFormEntry from '@/public/components/BillingInformationForm/BillingInformationForm.entry.vue';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';
import { CodedError } from '@/utils/error';

/**
 * DD-3548 round 2, from the host's side: logging properties changed after render, `CodedError`,
 * and whether a failure the element handles stays out of `UNHANDLED_ERROR` and the `error` event.
 */

// The real entry below imports `EntryProvider` from the barrel, which `vitest.setup.ts` mocks.
vi.unmock('@/components/providers');

vi.mock('@/components/providers/AuthProvider/AuthProvider.lib', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getAuth: () => ({ accessToken: ref('access-token') }),
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

const defineEntryElement = (child: Component) => {
    const tag = `solvimon-tester-r2-${++tagCount}`;
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

const entriesOf = (onLog: ReturnType<typeof vi.fn>): LogEntry[] =>
    onLog.mock.calls.map(([entry]) => entry as LogEntry);

/** A button whose click logs at the given level, so a test can log after the first render. */
const LoggingButton = defineComponent({
    setup() {
        const logger = useLogger();
        return () =>
            h(
                'button',
                {
                    class: 'tester-log',
                    onClick: () => {
                        logger.info('COMPONENT_INITIALIZED', 'info after render');
                        logger.warn('MISSING_REQUIRED_PROPERTIES', 'warn after render');
                    },
                },
                'log',
            );
    },
});

const click = (element: HTMLElement, selector: string) =>
    element.shadowRoot?.querySelector<HTMLElement>(selector)?.click();

describe('EntryProvider round 2 (tester)', () => {
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
        vi.unstubAllGlobals();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const sdkConsoleOutput = () =>
        [consoleError, consoleWarn, consoleInfo]
            .flatMap((spy) => spy.mock.calls)
            .filter(([first]) => String(first).startsWith('[solvimon]'));

    const mountRendered = async (child: Component, properties: Record<string, unknown> = {}) => {
        const recorded = createElement(defineEntryElement(child));
        Object.assign(recorded.element, {
            environment: 'TEST',
            portalObject: createTestPortalObject(),
            ...properties,
        });
        document.body.append(recorded.element);
        await settle();

        return recorded;
    };

    describe('logging properties changed after the element has rendered', () => {
        it('sends entries to the new onLog only, once each', async () => {
            const first = vi.fn();
            const second = vi.fn();
            const recorded = await mountRendered(LoggingButton, { onLog: first });
            first.mockClear();

            Object.assign(recorded.element, { onLog: second });
            await settle();
            click(recorded.element, '.tester-log');

            expect(first).not.toHaveBeenCalled();
            expect(entriesOf(second).map((entry) => entry.message)).toEqual(['warn after render']);
        });

        it('stops writing to the console once environment switches to LIVE, and says LIVE', async () => {
            const onLog = vi.fn();
            const recorded = await mountRendered(LoggingButton, { onLog });

            Object.assign(recorded.element, { environment: 'LIVE' });
            await settle();
            consoleError.mockClear();
            consoleWarn.mockClear();
            consoleInfo.mockClear();
            onLog.mockClear();
            click(recorded.element, '.tester-log');

            expect(sdkConsoleOutput()).toEqual([]);
            expect(entriesOf(onLog)[0]?.context).toMatchObject({ environment: 'LIVE' });
        });

        it('applies a logLevel changed after render', async () => {
            const onLog = vi.fn();
            const recorded = await mountRendered(LoggingButton, { onLog });

            Object.assign(recorded.element, { logLevel: 'info' });
            await settle();
            onLog.mockClear();
            click(recorded.element, '.tester-log');

            expect(entriesOf(onLog).map((entry) => entry.message)).toEqual([
                'info after render',
                'warn after render',
            ]);
        });

        it('calls onLog once per entry and dispatches one log event per entry', async () => {
            const onLog = vi.fn();
            const recorded = await mountRendered(LoggingButton, { onLog, logLevel: 'info' });
            onLog.mockClear();
            recorded.logEvents.length = 0;
            click(recorded.element, '.tester-log');

            expect(onLog).toHaveBeenCalledTimes(2);
            expect(recorded.logEvents).toHaveLength(2);
        });
    });

    describe('CodedError', () => {
        const throwing = (error: unknown) =>
            defineComponent({
                setup() {
                    throw error;
                },
            });

        it('is logged once under its own code, with element context, and fires error once', async () => {
            const onLog = vi.fn();
            const recorded = await mountRendered(
                throwing(new CodedError('INVALID_TOKEN', 'Invalid token')),
                { onLog },
            );

            const errors = entriesOf(onLog).filter((entry) => entry.level === 'error');
            expect(errors.map((entry) => entry.code)).toEqual(['INVALID_TOKEN']);
            expect(errors[0].context).toMatchObject({
                componentName: expect.stringContaining('solvimon-tester-r2-'),
                environment: 'TEST',
            });
            expect(recorded.errorEvents).toHaveLength(1);
            expect(recorded.errorEvents[0].detail[0]).toBeInstanceOf(CodedError);
        });

        it('keeps the message it was thrown with in the log entry', async () => {
            const onLog = vi.fn();
            await mountRendered(throwing(new CodedError('INVALID_TOKEN', 'Invalid token')), {
                onLog,
            });

            const [entry] = entriesOf(onLog).filter((logged) => logged.code === 'INVALID_TOKEN');
            // The entry's message is the generic 'Unhandled error'; the CodedError's own message
            // only survives in `error` / `errorSerialized`.
            expect(entry.errorSerialized?.message).toBe('Invalid token');
            expect(entry.message).toBe('Unhandled error');
        });

        it('falls back to UNHANDLED_ERROR for any other error, and for a non-Error', async () => {
            const onLog = vi.fn();
            const recorded = await mountRendered(throwing('a string'), { onLog });

            expect(
                entriesOf(onLog)
                    .filter((entry) => entry.level === 'error')
                    .map((entry) => entry.code),
            ).toEqual(['UNHANDLED_ERROR']);
            expect(recorded.errorEvents).toHaveLength(1);
        });
    });

    describe('a failure the element handles stays out of UNHANDLED_ERROR and the error event', () => {
        const customer = {
            id: 'cus_123',
            object_type: 'CUSTOMER',
            email: 'billing@example.com',
            type: 'INDIVIDUAL',
            individual: {
                name: { first_name: 'John', last_name: 'Doe' },
                residential_address: {
                    line1: 'Main street 1',
                    postal_code: '1000AA',
                    city: 'Amsterdam',
                    country: 'NL',
                },
            },
        };

        const json = (status: number, body: unknown) =>
            new Response(JSON.stringify(body), {
                status,
                headers: { 'content-type': 'application/json', 'x-request-id': 'req_1' },
            });

        // DEFECT: a refused save is logged as REQUEST_FAILED and shown inline, but
        // `useService.execute` rejects (with `undefined`) into the form's async submit handler,
        // which Vue hands to the boundary: UNHANDLED_ERROR plus an `error` event.
        it.fails(
            'billing-information-form: a refused save is not reported as unhandled',
            async () => {
                vi.stubGlobal(
                    'fetch',
                    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
                        const url = String(input);
                        const method = init?.method ?? 'GET';
                        if (url.includes('/portal/portal-urls/'))
                            return json(200, createTestPortalObject());
                        if (url.includes('/portal/customers/') && method === 'GET')
                            return json(200, customer);
                        if (url.includes('/portal/customers/'))
                            return json(422, { message: 'Invalid email', field: 'email' });
                        return json(404, {});
                    }),
                );
                const tag = `solvimon-tester-r2-bif-${++tagCount}`;
                customElements.define(tag, defineCustomElement(BillingInformationFormEntry));
                const recorded = createElement(tag);
                const onLog = vi.fn();
                Object.assign(recorded.element, {
                    environment: 'TEST',
                    portalObject: createTestPortalObject(),
                    onLog,
                });
                document.body.append(recorded.element);
                await settle();

                const form = recorded.element.shadowRoot?.querySelector('form');
                expect(form).toBeTruthy();
                form?.dispatchEvent(new Event('submit', { cancelable: true }));
                await settle();

                const codes = entriesOf(onLog).map((entry) => entry.code);
                expect(codes).toContain('REQUEST_FAILED');
                expect(codes).not.toContain('UNHANDLED_ERROR');
                expect(recorded.errorEvents).toEqual([]);
            },
        );
    });
});
