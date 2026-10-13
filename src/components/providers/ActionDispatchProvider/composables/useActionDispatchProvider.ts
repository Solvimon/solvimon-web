import { ACTION_DISPATCHER_PROVIDER_INJECTION_KEY } from '@/components/providers/ActionDispatchProvider/ActionDispatchProvider.lib';
import { injectOrThrow } from '@/utils/component';

export function useActionDispatchProvider() {
    return {
        dispatchAction: injectOrThrow(ACTION_DISPATCHER_PROVIDER_INJECTION_KEY, 'dispatchAction'),
    };
}
