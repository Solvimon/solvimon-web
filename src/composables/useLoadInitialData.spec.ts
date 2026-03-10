import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { useLoadInitialData } from './useLoadInitialData';

describe('useLoadInitialData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns isLoading ref initially true', () => {
        const service = vi.fn().mockResolvedValue(undefined);
        const Wrapper = defineComponent({
            setup() {
                return useLoadInitialData(service());
            },
            render: () => h('div'),
        });
        const wrapper = mount(Wrapper);
        expect(wrapper.vm.isLoading).toBe(true);
    });

    it('sets isLoading to false after all services resolve on mount', async () => {
        const Wrapper = defineComponent({
            setup() {
                return useLoadInitialData(Promise.resolve());
            },
            render: () => h('div'),
        });
        const wrapper = mount(Wrapper);

        await nextTick();
        await Promise.resolve();
        await nextTick();

        expect(wrapper.vm.isLoading).toBe(false);
    });

    it('waits for multiple services before setting isLoading to false', async () => {
        let resolveFirst: () => void;
        let resolveSecond: () => void;
        const first = new Promise<void>((r) => {
            resolveFirst = r;
        });
        const second = new Promise<void>((r) => {
            resolveSecond = r;
        });

        const Wrapper = defineComponent({
            setup() {
                return useLoadInitialData(first, second);
            },
            render: () => h('div'),
        });
        const wrapper = mount(Wrapper);

        await nextTick();
        expect(wrapper.vm.isLoading).toBe(true);

        resolveFirst!();
        await nextTick();
        await Promise.resolve();
        expect(wrapper.vm.isLoading).toBe(true);

        resolveSecond!();
        await nextTick();
        await Promise.resolve();
        await nextTick();

        expect(wrapper.vm.isLoading).toBe(false);
    });

    it('sets isLoading to false when no services are passed', async () => {
        const Wrapper = defineComponent({
            setup() {
                return useLoadInitialData();
            },
            render: () => h('div'),
        });
        const wrapper = mount(Wrapper);

        await nextTick();
        await Promise.resolve();
        await nextTick();

        expect(wrapper.vm.isLoading).toBe(false);
    });
});
