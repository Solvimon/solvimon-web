import type { InjectionKey } from 'vue';
import type { ActionRequestDetail, RequestAction } from './ActionDispatchProvider.lib.types';
import { useHostElementProvider } from '@/components/providers/HostElementProvider/composables/useHostElementProvider';

export const ACTION_DISPATCHER_PROVIDER_INJECTION_KEY: InjectionKey<
    ReturnType<typeof createActionDispatcher>
> = Symbol('requestActionDispatch');

export function createActionDispatcher(): RequestAction {
    const { hostRef } = useHostElementProvider();

    return (detail, originalEvent) => {
        const host = hostRef.value;
        if (!host) return true;

        const ev = new CustomEvent<ActionRequestDetail>('action-request', {
            detail,
            bubbles: true,
            composed: true,
            cancelable: true,
        });

        const allowed = host.dispatchEvent(ev);

        if (!allowed && originalEvent) {
            originalEvent.preventDefault();
        }

        return allowed;
    };
}
