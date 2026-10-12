import { ref } from 'vue';
import type { WalletAutoTopUpConfig } from '@solvimon/solvimon-types';
import { createAutoTopUpConfigsService } from '@/services/autoTopUpConfigs';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

export function useDeactivateAutoTopUpConfig() {
    const { deactivateAutoTopUpConfig } = createAutoTopUpConfigsService();
    const logger = useLogger();

    const isDeactivating = ref(false);

    /** Resolves whether the rule is off now. A failure is logged here and left to the caller to show. */
    const deactivate = async (configId?: WalletAutoTopUpConfig['id']): Promise<boolean> => {
        if (!configId || isDeactivating.value) {
            return false;
        }

        isDeactivating.value = true;

        try {
            await deactivateAutoTopUpConfig(configId);

            return true;
        } catch (error) {
            logger.error(
                'AUTO_TOP_UP_CANCELLATION_FAILED',
                "Failed to turn off a wallet's automatic top-up",
                {},
                error,
            );

            return false;
        } finally {
            isDeactivating.value = false;
        }
    };

    return { deactivate, isDeactivating };
}
