import { onMounted, ref } from 'vue';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

export function useLoadInitialData(...services: Promise<unknown | void>[]) {
    const isLoading = ref<boolean>(true);
    const logger = useLogger();

    onMounted(async () => {
        await Promise.all(services)
            .then(() => {
                isLoading.value = false;
            })
            .catch((error) => {
                isLoading.value = false;
                logger.error('INITIAL_DATA_LOAD_FAILED', 'Failed to load initial data', {}, error);
            });
    });

    return { isLoading };
}
