import { onMounted, ref } from 'vue';

export const useData = <T>(getData: () => Promise<T>, onError?: (error: any) => void) => {
    const data = ref<T>();
    const isPending = ref(true);

    onMounted(async () => {
        try {
            data.value = await getData();
        } catch (error) {
            onError?.(error);
        } finally {
            isPending.value = false;
        }
    });

    return { data, isPending };
};
