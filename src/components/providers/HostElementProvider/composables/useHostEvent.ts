import { inject } from 'vue';
import {
    dispatchHostEvent,
    HOST_ELEMENT_PROVIDER_INJECTION_KEY,
} from '@/components/providers/HostElementProvider/HostElementProvider.lib';
import type { SolvimonEventMap } from '@/public/core/events.types';

/**
 * Dispatches SDK events on the element the tree renders into (see `dispatchHostEvent`). Outside an
 * element, as a screen mounted on its own in a spec is, it dispatches nothing.
 */
export function useHostEvent(): <K extends keyof SolvimonEventMap>(
    name: K,
    detail: SolvimonEventMap[K]['detail'],
) => void {
    const hostRef = inject(HOST_ELEMENT_PROVIDER_INJECTION_KEY, null)?.hostRef;

    return <K extends keyof SolvimonEventMap>(name: K, detail: SolvimonEventMap[K]['detail']) =>
        dispatchHostEvent(hostRef?.value, name, detail);
}
