import { defineComponent } from 'vue';
import { createSolvimonElement } from './customElements';

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
