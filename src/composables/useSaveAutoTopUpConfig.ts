import { ref } from 'vue';
import type { WalletAutoTopUpConfigPayload } from '@solvimon/solvimon-types';
import { createAutoTopUpConfigsService } from '@/services/autoTopUpConfigs';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

export function useSaveAutoTopUpConfig() {
    const { createAutoTopUpConfig } = createAutoTopUpConfigsService();
    const logger = useLogger();

    const isSaving = ref(false);

    /**
     * Saves the rule and reports what happened. The error comes back rather than being raised: every
     * caller has already taken the customer's money or is mid-flow, and none of them can undo it —
     * but some do want to pass it on.
     *
     * An absent payload is a rule the customer has not finished, which is theirs to complete.
     */
    const save = async (
        payload?: WalletAutoTopUpConfigPayload,
    ): Promise<{ saved: boolean; error?: unknown }> => {
        if (!payload || isSaving.value) {
            return { saved: false };
        }

        isSaving.value = true;

        try {
            await createAutoTopUpConfig(payload);

            return { saved: true };
        } catch (error) {
            logger.error(
                'AUTO_TOP_UP_SAVE_FAILED',
                'Failed to save the automatic top-up rule',
                {},
                error,
            );

            return { saved: false, error };
        } finally {
            isSaving.value = false;
        }
    };

    return { save, isSaving };
}
