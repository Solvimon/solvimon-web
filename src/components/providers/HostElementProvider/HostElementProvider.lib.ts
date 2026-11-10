import type { ComponentInternalInstance, InjectionKey, Ref } from 'vue';
import type { SolvimonEventMap } from '@/public/core/events.types';

export interface HostElementContext {
    /**
     * The host element for the current component tree (custom element or mount container).
     */
    hostRef: Ref<HTMLElement | null>;
    /**
     * The component name (custom element name) for this tree, from ConfigProvider.
     */
    customElementName: string;
}

export const HOST_ELEMENT_PROVIDER_INJECTION_KEY: InjectionKey<HostElementContext> =
    Symbol('hostElement');

/**
 * The element a `defineCustomElement` tree renders into. Vue sets `ce` on the tree's root instance
 * only, which is why `useHost()` returns nothing below the entry component.
 */
export function getCustomElementHost(
    instance: ComponentInternalInstance | null,
): HTMLElement | null {
    const root = instance?.root;
    const host = root && 'ce' in root ? root.ce : undefined;

    return host instanceof HTMLElement ? host : null;
}

/**
 * Dispatches an SDK event on `host`: one of `SolvimonEventMap`, with the detail it declares. Every
 * SDK event bubbles and crosses the shadow root, so one listener on a container hears every element
 * inside it. Only `solvimon-payment-succeeded` is cancelable, since only it has a default action, the
 * checkout's redirect, that a host could stop. Without a host there is no one to tell, and it
 * dispatches nothing.
 *
 * @returns `false` when a listener cancelled the event.
 */
export function dispatchHostEvent<K extends keyof SolvimonEventMap>(
    host: HTMLElement | null | undefined,
    name: K,
    detail: SolvimonEventMap[K]['detail'],
): boolean {
    const cancelable = name === 'solvimon-payment-succeeded';

    return (
        host?.dispatchEvent(
            new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable }),
        ) ?? true
    );
}
