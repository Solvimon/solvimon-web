import { onUnmounted, toValue, watch, type MaybeRefOrGetter, type WatchSource } from 'vue';

export function useWatchDebounced<T>(
    source: WatchSource<T>,
    callback: (value: T, oldValue: T) => void,
    options: {
        /**
         * Read on every change, so a getter can wait only when there is something to wait for. A
         * delay of 0 calls back straight away rather than on a timer.
         */
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
