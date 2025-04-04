import { onMounted, ref } from 'vue'

export const useData = <T extends unknown>(getData: () => Promise<T>) => {
    const data = ref<T>();
    const isPending = ref(true);

    onMounted(async () => {
        try {
            data.value = await getData();
        } catch (error) {
            console.error(error)
        } finally {
            isPending.value = false;
        }
    })

    return { data, isPending };
};