import type { InjectionKey } from 'vue';
import type { RequestAction } from './ActionDispatchProvider.lib.types';
import { useHostElementProvider } from '@/components/providers/HostElementProvider/composables/useHostElementProvider';
import { dispatchHostEvent } from '@/components/providers/HostElementProvider/HostElementProvider.lib';

export const ACTION_DISPATCHER_PROVIDER_INJECTION_KEY: InjectionKey<
    ReturnType<typeof createActionDispatcher>
> = Symbol('requestActionDispatch');

export function createActionDispatcher(): RequestAction {
    const { hostRef } = useHostElementProvider();

    return (detail, originalEvent) => {
        const host = hostRef.value;
        if (!host) return true;

        const allowed = dispatchHostEvent(host, 'action-request', detail, { cancelable: true });

        if (!allowed && originalEvent) {
            originalEvent.preventDefault();
        }

        return allowed;
    };
}
