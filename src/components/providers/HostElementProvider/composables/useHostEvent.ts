import { inject } from 'vue';
import { HOST_ELEMENT_PROVIDER_INJECTION_KEY } from '@/components/providers/HostElementProvider/HostElementProvider.lib';

/**
 * Dispatches an SDK event on the element the tree renders into. Every SDK event bubbles and
 * crosses the shadow root, so one listener on a container hears every element inside it. Returns
 * `false` when a listener cancelled a cancelable event. Outside an element there is no one to
 * tell, so it dispatches nothing.
 */
export function useHostEvent() {
    const hostRef = inject(HOST_ELEMENT_PROVIDER_INJECTION_KEY, null)?.hostRef;

    return (name: string, detail?: unknown, { cancelable = false } = {}): boolean =>
        hostRef?.value?.dispatchEvent(
            new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable }),
        ) ?? true;
}
