import { inject } from 'vue';
import { ACTION_DISPATCHER_PROVIDER_INJECTION_KEY } from '@/components/providers/ActionDispatchProvider/ActionDispatchProvider.lib';

export function useActionDispatchProvider() {
    const dispatchAction = inject(ACTION_DISPATCHER_PROVIDER_INJECTION_KEY);

    if (!dispatchAction) {
        throw new Error('dispatchAction is not provided');
    }

    return { dispatchAction };
}
