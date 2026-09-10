import { defineComponent } from 'vue';
import { vi } from 'vitest';

const passThrough = () =>
    defineComponent({
        inheritAttrs: false,
        setup(_, { slots }) {
            return () => slots.default?.();
        },
    });

/** Exported so a spec can assert on what a component reported. */
export const providerMockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    capture: vi.fn(),
};

export const createProviderMock = () => ({
    Provider: passThrough(),
    EntryProvider: passThrough(),
    useActionDispatchProvider: () => ({
        dispatchAction: vi.fn(),
    }),
    useLogger: () => providerMockLogger,
});
