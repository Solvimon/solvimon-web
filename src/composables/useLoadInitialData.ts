import { onMounted, ref } from 'vue';

export function useLoadInitialData(...services: Promise<unknown | void>[]) {
    const isLoading = ref<boolean>(true);

    onMounted(async () => {
        await Promise.all(services).then(() => {
            isLoading.value = false;
        });
    });

    return { isLoading };
}
