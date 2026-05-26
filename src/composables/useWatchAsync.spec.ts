import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useWatchAsync } from './useWatchAsync';

function mountWithSource<T, R>(source: () => T, loader: (value: T) => Promise<R>, initial: R) {
    let instance!: ReturnType<typeof useWatchAsync<T, R>>;

    mount(
        defineComponent({
            setup() {
                instance = useWatchAsync(source, loader, initial);
            },
            render: () => h('div'),
        }),
    );

    return instance;
}

describe('useWatchAsync', () => {
    it('returns the initial value before the loader resolves', () => {
        const { data, version } = mountWithSource(
            () => 'a',
            () => new Promise(() => {}),
            'initial',
        );

        expect(data.value).toBe('initial');
        expect(version.value).toBe(0);
    });

    it('calls the loader immediately with the current source value', () => {
        const loader = vi.fn().mockResolvedValue('result');

        mountWithSource(() => 'hello', loader, '');

        expect(loader).toHaveBeenCalledOnce();
        expect(loader).toHaveBeenCalledWith('hello');
    });

    it('updates data and increments version when the loader resolves', async () => {
        const { data, version } = mountWithSource(
            () => 'a',
            () => Promise.resolve('loaded'),
            '',
        );

        await nextTick();

        expect(data.value).toBe('loaded');
        expect(version.value).toBe(1);
    });

    it('re-runs the loader when the source changes', async () => {
        const source = ref('a');
        const loader = vi.fn().mockResolvedValue('result');

        mountWithSource(() => source.value, loader, '');

        source.value = 'b';
        await nextTick();
        await nextTick();

        expect(loader).toHaveBeenCalledTimes(2);
        expect(loader).toHaveBeenLastCalledWith('b');
    });

    it('ignores a stale result when the source changes before the loader resolves', async () => {
        const source = ref('a');
        let resolveFirst!: (v: string) => void;
        let resolveSecond!: (v: string) => void;

        const loader = vi
            .fn()
            .mockReturnValueOnce(new Promise<string>((r) => { resolveFirst = r; }))
            .mockReturnValueOnce(new Promise<string>((r) => { resolveSecond = r; }));

        const { data, version } = mountWithSource(() => source.value, loader, '');

        source.value = 'b';
        await nextTick();

        resolveSecond('result-b');
        await nextTick();

        resolveFirst('result-a');
        await nextTick();

        expect(data.value).toBe('result-b');
        expect(version.value).toBe(1);
    });
});
