import { defineCustomElement as defineCustomElementVue } from 'vue';
import type { CustomElementOptions } from 'vue';
import { componentStyles } from '@solvimon/solvimon-ui/component-styles';
import tailwindStyles from '../../.sdk/tailwind.css?inline';
import {
    adoptStyleSheet,
    createStyleSheet,
    supportsConstructedStyleSheets,
} from '@/utils/styleSheets';
import { getComponentName } from '@/utils/component';

type CustomElementComponent = Parameters<typeof defineCustomElementVue>[0] & {
    styles?: string[];
};

/**
 * The same CSS for every element the SDK defines, so it is parsed once and adopted by all of their
 * shadow roots instead of once per component the host puts on the page.
 */
const baseStyles = [tailwindStyles, ...componentStyles];

let baseStyleSheet: CSSStyleSheet | undefined;

const getBaseStyleSheet = () => (baseStyleSheet ??= createStyleSheet(baseStyles.join('\n')));

/**
 * Define a custom element from a vue component.
 * Note that type errors will occur when using required props, as that's not possible with custom elements.
 * Instead, handle missing props in the component itself.
 */
export function defineCustomElement(
    component: CustomElementComponent,
    options: CustomElementOptions = {},
) {
    const ownStyles = [...(component.styles ?? []), ...(options.styles ?? [])];

    if (!supportsConstructedStyleSheets) {
        return defineCustomElementVue(component, {
            shadowRoot: true,
            styles: [...baseStyles, ...ownStyles],
            ...options,
        });
    }

    // Anything this element adds on top is parsed once for the element, not once per instance.
    const sheets = ownStyles.length
        ? [getBaseStyleSheet(), createStyleSheet(ownStyles.join('\n'))]
        : [getBaseStyleSheet()];

    const CustomElement = defineCustomElementVue(component, {
        shadowRoot: true,
        ...options,
        // Adopted below instead, so Vue does not build a `<style>` per instance.
        styles: [],
    });

    return class extends CustomElement {
        constructor(...args: ConstructorParameters<typeof CustomElement>) {
            super(...args);

            // Vue attaches the shadow root while constructing, so these land before anything renders
            // into it — which is what keeps a customer's own CSS cascading after them.
            const root = this.shadowRoot;

            if (root) {
                sheets.forEach((sheet) => adoptStyleSheet(root, sheet));
            }
        }
    };
}

/**
 * The element, its tag name and an idempotent define for it — the three things every SDK entry
 * exports.
 */
export function createSolvimonElement(component: CustomElementComponent, tagName: string) {
    const element = defineCustomElement(component);
    const componentName = getComponentName(tagName);

    return {
        element,
        componentName,
        define: (): void => {
            if (!customElements.get(componentName)) {
                customElements.define(componentName, element);
            }
        },
    };
}
