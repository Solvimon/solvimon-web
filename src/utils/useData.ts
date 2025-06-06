import { onMounted, ref, watch, type Ref } from 'vue';

export const useData = <T, V extends string | undefined>({
    getData,
    onError,
    watchValue,
}: {
    getData: (watchValue?: Ref<V>) => Promise<T>;
    onError?: (error: any) => void;
    watchValue?: Ref<V>;
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
            watch(watchValue, async () => {
                void handleGetData();
            });
        }
    });

    return { data, isPending };
};
