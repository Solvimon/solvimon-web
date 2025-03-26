import { type CustomElementOptions, defineCustomElement as defineCustomElementVue, type VueElementConstructor } from 'vue';

import tailwindStyles from '../../.sdk/tailwind.css?inline'

export const defineCustomElement = (element: CustomElementOptions & VueElementConstructor) => {
    return defineCustomElementVue(element, {
        shadowRoot: true,
        styles: [tailwindStyles, ...(element.styles ?? [])]
    });
}