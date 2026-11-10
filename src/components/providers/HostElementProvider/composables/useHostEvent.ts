import { inject } from 'vue';
import {
    dispatchHostEvent,
    HOST_ELEMENT_PROVIDER_INJECTION_KEY,
} from '@/components/providers/HostElementProvider/HostElementProvider.lib';

/**
 * Dispatches SDK events on the element the tree renders into (see `dispatchHostEvent`). Outside an
 * element, as a screen mounted on its own in a spec is, it dispatches nothing.
 */
export function useHostEvent() {
    const hostRef = inject(HOST_ELEMENT_PROVIDER_INJECTION_KEY, null)?.hostRef;

    return (name: string, detail?: unknown, options?: { cancelable?: boolean }): boolean =>
        dispatchHostEvent(hostRef?.value, name, detail, options);
}
