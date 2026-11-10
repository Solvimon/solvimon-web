import type { ComponentInternalInstance, InjectionKey, Ref } from 'vue';

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
 * Dispatches an SDK event on `host`. Every SDK event bubbles and crosses the shadow root, so one
 * listener on a container hears every element inside it. Returns `false` when a listener cancelled
 * a cancelable event; without a host there is no one to tell, and it dispatches nothing.
 */
export function dispatchHostEvent(
    host: HTMLElement | null | undefined,
    name: string,
    detail?: unknown,
    { cancelable = false }: { cancelable?: boolean } = {},
): boolean {
    return (
        host?.dispatchEvent(
            new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable }),
        ) ?? true
    );
}
