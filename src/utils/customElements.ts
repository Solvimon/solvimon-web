/* eslint-disable @typescript-eslint/no-explicit-any */
import { type DefineComponent, defineCustomElement as defineCustomElementVue } from 'vue';

import tailwindStyles from '../../.sdk/tailwind.css?inline';

type CustomElementOptions = Parameters<typeof defineCustomElementVue>[1];

/**
 * Define a custom element from a vue component.
 * Note that type errors will occur when using required props, as that's not possible with custom elements.
 * Instead, handle missing props in the component itself.
 */
export function defineCustomElement<T extends DefineComponent<any, any, any>>(
    component: T,
    options: CustomElementOptions = {},
) {
    return defineCustomElementVue(component, {
        shadowRoot: true,
        styles: [tailwindStyles, ...(component.styles ?? []), ...(options.styles ?? [])],
        ...options,
    });
}
