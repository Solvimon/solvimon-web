import { onUnmounted, toValue, watch, type MaybeRefOrGetter, type WatchSource } from 'vue';

export function useWatchDebounced<T>(
    source: WatchSource<T>,
    callback: (value: T, oldValue: T) => void,
    options: {
        debounce: number;
        /**
         * Read on every change. While it holds, the callback runs straight away rather than on a
         * timer, for a caller that only has something to wait for some of the time.
         */
        debounceDisabled?: MaybeRefOrGetter<boolean>;
        deep?: boolean;
    },
): void {
    let timer: ReturnType<typeof setTimeout>;

    watch(
        source,
        (value, oldValue) => {
            clearTimeout(timer);

            if (toValue(options.debounceDisabled)) {
                callback(value, oldValue);
                return;
            }

            timer = setTimeout(() => callback(value, oldValue), options.debounce);
        },
        { deep: options.deep },
    );

    onUnmounted(() => clearTimeout(timer));
}
