import { defineComponent } from 'vue';
import { vi } from 'vitest';

export const createProviderMock = () => ({
    Provider: defineComponent({
        inheritAttrs: false,
        setup(_, { slots }) {
            return () => slots.default?.();
        },
    }),
    useActionDispatchProvider: () => ({
        dispatchAction: vi.fn(),
    }),
});
