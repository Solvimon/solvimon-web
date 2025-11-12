import { watchDebounced } from '@vueuse/core';
import { onMounted, ref, type Ref } from 'vue';

export const useData = <T, V extends string | undefined>({
    getData,
    onError,
    watchValue,
    debounce = 200,
}: {
    getData: (watchValue?: Ref<V>) => Promise<T>;
    onError?: (error: unknown) => void;
    watchValue?: Ref<V>;
    debounce?: number;
}) => {
    const data = ref<T>();
    const isPending = ref(true);

    const handleGetData = async () => {
        try {
            data.value = await getData(watchValue);
        } catch (error) {
            onError?.(error);
        } finally {
            isPending.value = false;
        }
    };

    onMounted(async () => {
        void handleGetData();

        if (watchValue) {
            watchDebounced(
                watchValue,
                () => {
                    void handleGetData();
                },
                { debounce },
            );
        }
    });

    return { data, isPending };
};
