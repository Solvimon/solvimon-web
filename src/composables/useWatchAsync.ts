import { shallowRef, ref, watch, type Ref, type WatchSource } from 'vue';
import { createLatestGuard } from '@/utils/async';

export function useWatchAsync<T, R>(
    source: WatchSource<T>,
    loader: (value: T) => Promise<R>,
    initial: R,
): { data: Ref<R>; version: Ref<number> } {
    const data = shallowRef(initial);
    const version = ref(0);
    const latestGuard = createLatestGuard();

    watch(
        source,
        async (value) => {
            const isLatest = latestGuard();
            const result = await loader(value);
            if (isLatest()) {
                data.value = result;
                version.value++;
            }
        },
        { immediate: true },
    );

    return { data, version };
}
