import { defineComponent, defineCustomElement as defineCustomElementVue } from 'vue';
import { componentStyles } from '@solvimon/solvimon-ui/component-styles';
import { createSolvimonElement, defineCustomElement } from './customElements';

vi.mock('vue', async (importOriginal) => {
    const actual = await importOriginal<typeof import('vue')>();
    return { ...actual, defineCustomElement: vi.fn(actual.defineCustomElement) };
});

const component = defineComponent({ render: () => null });

describe('createSolvimonElement', () => {
    it('exposes only a define function', () => {
        expect(Object.keys(createSolvimonElement(component, 'thing'))).toStrictEqual(['define']);
    });

    it('registers under the canonical solvimon- tag by default', () => {
        createSolvimonElement(component, 'default-tag').define();

        expect(customElements.get('solvimon-default-tag')).toBeDefined();
    });

    it('registers under a tag the host chooses, for a page where the name is taken', () => {
        createSolvimonElement(component, 'renamed').define('acme-renamed');

        expect(customElements.get('acme-renamed')).toBeDefined();
        expect(customElements.get('solvimon-renamed')).toBeUndefined();
    });

    it('leaves an already registered name alone rather than throwing', () => {
        const { define } = createSolvimonElement(component, 'twice');

        define();
        const first = customElements.get('solvimon-twice');

        expect(() => define()).not.toThrow();
        expect(customElements.get('solvimon-twice')).toBe(first);
    });
});

// jsdom has no `adoptedStyleSheets`, so this is the `<style>` fallback older browsers get.
describe('defineCustomElement without constructed stylesheets', () => {
    it('keeps the base styles under styles passed in the options', () => {
        defineCustomElement(component, { styles: ['.own {}'] });

        const { styles } = vi.mocked(defineCustomElementVue).mock.lastCall![1] as {
            styles: string[];
        };

        expect(styles.at(-1)).toBe('.own {}');
        expect(styles).toEqual(expect.arrayContaining(componentStyles));
    });
});
