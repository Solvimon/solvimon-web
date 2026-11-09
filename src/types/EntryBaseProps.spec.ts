import type { Component } from 'vue';
import Provider from '@/components/providers/Provider/Provider.vue';

/**
 * An element's properties are its entry's declared props, so what each entry declares is public.
 * Every entry takes the base props, and none takes any other prop of the provider stack, read off
 * the provider itself so that one added there later is caught too.
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

const PROVIDER_ONLY_PROPS = Object.keys(
    (Provider as Component & { props?: Record<string, unknown> }).props ?? {},
).filter((prop) => !BASE_PROPS.includes(prop));

describe('element properties', () => {
    it('finds the entries and the provider props, so an empty read cannot pass these', () => {
        expect(declaredProps.length).toBeGreaterThan(0);
        expect(PROVIDER_ONLY_PROPS).toContain('primaryColor');
    });

    it.each(declaredProps)('$path takes every base property', ({ props }) => {
        expect(props).toEqual(expect.arrayContaining(BASE_PROPS));
    });

    it.each(declaredProps)('$path takes no provider prop it ignores', ({ props }) => {
        expect(props.filter((prop) => PROVIDER_ONLY_PROPS.includes(prop))).toEqual([]);
    });
});
