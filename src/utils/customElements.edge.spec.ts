import { defineComponent } from 'vue';
import { createSolvimonElement } from './customElements';

const component = defineComponent({ render: () => null });

describe('createSolvimonElement — names another script already took', () => {
    it('falls back to the default name when the one the host asked for is taken', () => {
        customElements.define('acme-taken', class extends HTMLElement {});
        const { define } = createSolvimonElement(component, 'taken');

        define('acme-taken');

        // The core asks for the default next; that name is free, so the element registers there.
        expect(define()).toBe('solvimon-taken');
        expect(customElements.get('solvimon-taken')).toBeDefined();
    });

    /**
     * Another bundle — a second copy of the SDK, say — registered the canonical name first. `define`
     * reports that name as the one the element is registered under, and the core then mounts the
     * other bundle's element. Same as main, which also left the name alone; marked as an expected
     * failure because the return value now claims a registration that did not happen.
     */
    it.fails('does not report a name some other class is registered under as its own', () => {
        class Foreign extends HTMLElement {}
        customElements.define('solvimon-foreign', Foreign);

        const name = createSolvimonElement(component, 'foreign').define();

        expect(customElements.get(name)).not.toBe(Foreign);
    });
});
