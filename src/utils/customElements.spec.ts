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

    it('keeps the name a host chose when the default is asked for afterwards, as the core does', () => {
        const { define } = createSolvimonElement(component, 'host-first');

        expect(define('acme-host-first')).toBe('acme-host-first');
        expect(() => define()).not.toThrow();
        expect(define()).toBe('acme-host-first');
        expect(customElements.get('solvimon-host-first')).toBeUndefined();
    });

    it('does not register the class under a second name', () => {
        const { define } = createSolvimonElement(component, 'second-name');

        define();

        expect(() => define('acme-second-name')).not.toThrow();
        expect(define('acme-second-name')).toBe('solvimon-second-name');
        expect(customElements.get('acme-second-name')).toBeUndefined();
    });

    it('returns the name it registered under', () => {
        expect(createSolvimonElement(component, 'named').define()).toBe('solvimon-named');
    });
});

describe('createSolvimonElement when another script took the name', () => {
    it('falls back to the default name when the one the host asked for is taken', () => {
        customElements.define('acme-taken', class extends HTMLElement {});
        const { define } = createSolvimonElement(component, 'taken');

        define('acme-taken');

        // The core asks for the default next; that name is free, so the element registers there.
        expect(define()).toBe('solvimon-taken');
        expect(customElements.get('solvimon-taken')).toBeDefined();
    });

    /**
     * Another bundle, such as a second copy of the SDK, registered the canonical name first. `define`
     * still reports that name as its own, so the core mounts the other bundle's element. Expected to
     * fail until `define` stops claiming a registration that did not happen.
     */
    it.fails('does not report a name some other class is registered under as its own', () => {
        class Foreign extends HTMLElement {}
        customElements.define('solvimon-foreign', Foreign);

        const name = createSolvimonElement(component, 'foreign').define();

        expect(customElements.get(name)).not.toBe(Foreign);
    });
});
