import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import type { CustomerPortalUrl, Environment } from '@solvimon/solvimon-types';
import EntryProvider from './EntryProvider.vue';
import type { EntryProviderProps } from './EntryProvider.types';
import type { LogEntry } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

vi.mock('@/components/providers/AuthProvider/AuthProvider.lib', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getAuth: () => ({
        accessToken: ref('access-token'),
        getFreshAccessToken: async () => 'access-token',
        renewAccessToken: async () => undefined,
    }),
}));

const Content = defineComponent({ setup: () => () => h('p', { class: 'content' }, 'content') });

const Throwing = defineComponent({
    setup() {
        throw new Error('setup broke');
    },
});

const mountEntryProvider = (
    entry: Partial<EntryProviderProps['entry']>,
    {
        slot = Content,
        requiredConfiguration,
    }: {
        slot?: ReturnType<typeof defineComponent>;
        requiredConfiguration?: Record<string, unknown>;
    } = {},
) => {
    const onLog = vi.fn<(entry: LogEntry) => void>();
    const wrapper = mount(EntryProvider, {
        props: {
            entry: {
                environment: 'TEST',
                portalObject: createTestPortalObject(),
                onLog,
                ...entry,
            } as EntryProviderProps['entry'],
            componentName: 'solvimon-test',
            allowedPortalTypes: ['CUSTOMER'],
            requiredConfiguration,
        },
        slots: { default: () => h(slot) },
    });

    return { wrapper, onLog };
};

/** The translation catalogue is a dynamic import, and the tree below waits for it. */
const settle = async () => {
    await flushPromises();
    await vi.dynamicImportSettled();
    await flushPromises();
};

type OnLog = ReturnType<typeof vi.fn<(entry: LogEntry) => void>>;

const codesLogged = (onLog: OnLog) => onLog.mock.calls.map(([entry]) => entry.code);

describe('EntryProvider', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('required properties', () => {
        it('renders nothing instead of throwing while a required property is missing', () => {
            const { wrapper } = mountEntryProvider({
                portalObject: undefined as unknown as CustomerPortalUrl,
            });

            expect(wrapper.find('.content').exists()).toBe(false);
        });

        it('reports what is still missing once the host has had a task to set it', async () => {
            const { onLog } = mountEntryProvider({
                environment: undefined as unknown as Environment,
            });

            expect(codesLogged(onLog)).not.toContain('MISSING_REQUIRED_PROPERTIES');

            vi.runOnlyPendingTimers();

            const entry = onLog.mock.calls
                .map(([logged]) => logged)
                .find((logged) => logged.code === 'MISSING_REQUIRED_PROPERTIES');
            expect(entry?.level).toBe('warn');
            expect(entry?.context).toMatchObject({ missing: ['environment'] });
        });

        it('says nothing about properties set right after the element mounted', async () => {
            const { wrapper, onLog } = mountEntryProvider({
                portalObject: undefined as unknown as CustomerPortalUrl,
            });

            await wrapper.setProps({
                entry: {
                    environment: 'TEST',
                    portalObject: createTestPortalObject(),
                    onLog,
                } as EntryProviderProps['entry'],
            });
            vi.runOnlyPendingTimers();

            expect(codesLogged(onLog)).not.toContain('MISSING_REQUIRED_PROPERTIES');
        });

        it('renders once the last required property arrives', async () => {
            const { wrapper, onLog } = mountEntryProvider({
                portalObject: undefined as unknown as CustomerPortalUrl,
            });
            vi.runOnlyPendingTimers();

            await wrapper.setProps({
                entry: {
                    environment: 'TEST',
                    portalObject: createTestPortalObject(),
                    onLog,
                } as EntryProviderProps['entry'],
            });
            await settle();

            expect(wrapper.find('.content').exists()).toBe(true);
        });

        it('waits for the configuration an entry names as required', () => {
            const { wrapper, onLog } = mountEntryProvider(
                {},
                { requiredConfiguration: { invoiceId: undefined } },
            );
            vi.runOnlyPendingTimers();

            expect(wrapper.find('.content').exists()).toBe(false);
            expect(onLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'MISSING_REQUIRED_PROPERTIES',
                    context: expect.objectContaining({ missing: ['configuration.invoiceId'] }),
                }),
            );
        });
    });

    describe('errors', () => {
        it('logs an error thrown below it and emits it as the public error event', async () => {
            const { wrapper, onLog } = mountEntryProvider({}, { slot: Throwing });
            await settle();

            expect(onLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: 'error',
                    code: 'UNHANDLED_ERROR',
                    error: expect.objectContaining({ message: 'setup broke' }),
                }),
            );
            const [[emitted]] = wrapper.emitted<[Error]>('error') ?? [[]];
            expect(emitted).toBeInstanceOf(Error);
            expect(emitted?.message).toBe('setup broke');
        });

        it('reports an environment it does not know rather than failing silently', async () => {
            const { wrapper, onLog } = mountEntryProvider({
                environment: 'STAGING' as Environment,
            });
            await settle();

            expect(codesLogged(onLog)).toContain('UNHANDLED_ERROR');
            const [[emitted]] = wrapper.emitted<[Error]>('error') ?? [[]];
            expect(emitted?.message).toMatch(/Unknown Solvimon environment "STAGING"/);
        });
    });
});
