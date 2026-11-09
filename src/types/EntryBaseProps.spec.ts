import type { Component } from 'vue';

/**
 * An element's properties are its entry's declared props, so what each entry declares is public.
 * Every entry takes the base props, and none takes a prop of the provider stack it does not read.
 */
const entries = import.meta.glob<{ default: Component & { props?: Record<string, unknown> } }>(
    '/src/public/**/*.entry.vue',
    { eager: true },
);

const declaredProps = Object.entries(entries).map(([path, module]) => ({
    path,
    props: Object.keys(module.default.props ?? {}),
}));

const BASE_PROPS = [
    'environment',
    'locale',
    'dateLocale',
    'messages',
    'portalObject',
    'portalToken',
    'branding',
    'experimentalFeatures',
    'logLevel',
    'onLog',
    'cssOverrides',
];

const IGNORED_PROVIDER_PROPS = [
    'allowedPortalTypes',
    'primaryColor',
    'secondaryColor',
    'isShadowRoot',
    'customElementName',
];

describe('element properties', () => {
    it('finds every entry, so an empty glob cannot pass these', () => {
        expect(declaredProps.length).toBeGreaterThanOrEqual(18);
    });

    it.each(declaredProps)('$path takes every base property', ({ props }) => {
        expect(props).toEqual(expect.arrayContaining(BASE_PROPS));
    });

    it.each(declaredProps)('$path takes no provider prop it ignores', ({ props }) => {
        expect(props.filter((prop) => IGNORED_PROVIDER_PROPS.includes(prop))).toEqual([]);
    });
});
