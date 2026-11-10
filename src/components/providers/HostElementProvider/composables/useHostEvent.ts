import { inject } from 'vue';
import {
    dispatchHostEvent,
    HOST_ELEMENT_PROVIDER_INJECTION_KEY,
} from '@/components/providers/HostElementProvider/HostElementProvider.lib';
import type { SolvimonEventMap } from '@/public/core/events.types';

/** Dispatches SDK events from a component, and names the element it renders in. */
export interface HostEvent {
    dispatch: <K extends keyof SolvimonEventMap>(
        name: K,
        detail: SolvimonEventMap[K]['detail'],
    ) => boolean;
    /** The tag name of the element, for a `detail` that says where it came from. */
    componentName: string;
}

/**
 * Dispatches SDK events on the element the tree renders into (see `dispatchHostEvent`). Outside an
 * element, as a screen mounted on its own in a spec is, it dispatches nothing and returns `true`.
 */
export function useHostEvent(): HostEvent {
    const host = inject(HOST_ELEMENT_PROVIDER_INJECTION_KEY, null);

    return {
        dispatch: (name, detail) => dispatchHostEvent(host?.hostRef.value, name, detail),
        componentName: host?.customElementName ?? '',
    };
}
