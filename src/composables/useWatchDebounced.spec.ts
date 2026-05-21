import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useWatchDebounced } from './useWatchDebounced';

const mountWithSource = <T>(
    source: () => T,
    callback: (value: T, oldValue: T) => void,
    debounce = 200,
) => {
    const Wrapper = defineComponent({
        setup() {
            useWatchDebounced(source, callback, { debounce });
        },
        render: () => h('div'),
    });
    return mount(Wrapper);
};

describe('useWatchDebounced', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not call the callback before the debounce delay has elapsed', async () => {
        const callback = vi.fn();
        const source = ref(0);

        mountWithSource(() => source.value, callback);

        source.value = 1;
        await nextTick();

        expect(callback).not.toHaveBeenCalled();
    });

    it('calls the callback with the new and old value after the debounce delay', async () => {
        const callback = vi.fn();
        const source = ref(0);

        mountWithSource(() => source.value, callback);

        source.value = 1;
        await nextTick();
        vi.advanceTimersByTime(200);

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith(1, 0);
    });

    it('debounces multiple rapid changes into a single callback call', async () => {
        const callback = vi.fn();
        const source = ref(0);

        mountWithSource(() => source.value, callback);

        source.value = 1;
        await nextTick();
        source.value = 2;
        await nextTick();
        source.value = 3;
        await nextTick();

        vi.advanceTimersByTime(200);

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith(3, 2);
    });

    it('calls the callback again for a second change after the first debounce settles', async () => {
        const callback = vi.fn();
        const source = ref(0);

        mountWithSource(() => source.value, callback);

        source.value = 1;
        await nextTick();
        vi.advanceTimersByTime(200);

        source.value = 2;
        await nextTick();
        vi.advanceTimersByTime(200);

        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenNthCalledWith(2, 2, 1);
    });

    it('does not call the callback after the component is unmounted', async () => {
        const callback = vi.fn();
        const source = ref(0);

        const wrapper = mountWithSource(() => source.value, callback);

        source.value = 1;
        await nextTick();

        await wrapper.unmount();
        vi.advanceTimersByTime(200);

        expect(callback).not.toHaveBeenCalled();
    });
});
