import { onUnmounted, watch, type WatchSource } from 'vue';

export function useWatchDebounced<T>(
    source: WatchSource<T>,
    callback: (value: T, oldValue: T) => void,
    options: { debounce: number },
): void {
    let timer: ReturnType<typeof setTimeout>;

    watch(source, (value, oldValue) => {
        clearTimeout(timer);
        timer = setTimeout(() => callback(value, oldValue), options.debounce);
    });

    onUnmounted(() => clearTimeout(timer));
}
