import { type DefineComponent, defineCustomElement as defineCustomElementVue } from 'vue';

import tailwindStyles from '../../.sdk/tailwind.css?inline';

// even though the type "looks like" a DefineComponent<any, any, any>,
// TypeScript treats SFCs imported from .vue files as complex intersection types that
// don't fully satisfy the base DefineComponent signature, even if they technically extend it.
// So allow as unknown and cast it to the correct type later.
export const defineCustomElement = (element: unknown) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const safeElement = element as DefineComponent<any, any, any> & {
        styles?: string[];
    };

    return defineCustomElementVue(safeElement, {
        shadowRoot: true,
        styles: [tailwindStyles, ...(safeElement.styles ?? [])],
    });
};
