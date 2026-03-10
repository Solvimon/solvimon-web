import type { InjectionKey, Ref } from 'vue';

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
