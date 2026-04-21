import { defineCustomElement as defineCustomElementVue } from 'vue';

import tailwindStyles from '../../.sdk/tailwind.css?inline';

type CustomElementComponent = Parameters<typeof defineCustomElementVue>[0];
type CustomElementOptions = Parameters<typeof defineCustomElementVue>[1];

/**
 * Define a custom element from a vue component.
 * Note that type errors will occur when using required props, as that's not possible with custom elements.
 * Instead, handle missing props in the component itself.
 */
export function defineCustomElement(component: CustomElementComponent, options: CustomElementOptions = {}) {
    const componentWithStyles = component as { styles?: string[] };

    return defineCustomElementVue(component, {
        shadowRoot: true,
        styles: [tailwindStyles, ...(componentWithStyles.styles ?? []), ...(options.styles ?? [])],
        ...options,
    });
}
