import { defineComponent } from 'vue';
import { vi } from 'vitest';

const passThrough = () =>
    defineComponent({
        inheritAttrs: false,
        setup(_, { slots }) {
            return () => slots.default?.();
        },
    });

export const createProviderMock = () => ({
    Provider: passThrough(),
    EntryProvider: passThrough(),
    useActionDispatchProvider: () => ({
        dispatchAction: vi.fn(),
    }),
});
