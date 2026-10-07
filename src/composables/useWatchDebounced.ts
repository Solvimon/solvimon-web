import { onUnmounted, toValue, watch, type MaybeRefOrGetter, type WatchSource } from 'vue';

export function useWatchDebounced<T>(
    source: WatchSource<T>,
    callback: (value: T, oldValue: T) => void,
    options: {
        debounce: MaybeRefOrGetter<number>;
        deep?: boolean;
    },
): void {
    let timer: ReturnType<typeof setTimeout>;

    watch(
        source,
        (value, oldValue) => {
            clearTimeout(timer);

            const delay = toValue(options.debounce);

            if (delay <= 0) {
                callback(value, oldValue);
                return;
            }

            timer = setTimeout(() => callback(value, oldValue), delay);
        },
        { deep: options.deep },
    );

    onUnmounted(() => clearTimeout(timer));
}
