import { defineComponent, defineCustomElement, h, inject } from 'vue';
import { mount } from '@vue/test-utils';
import HostElementProvider from './HostElementProvider.vue';
import { HOST_ELEMENT_PROVIDER_INJECTION_KEY } from './HostElementProvider.lib';

/** Records the host it can see while setting up, which is when a provider below first needs it. */
const createProbe = (seen: (HTMLElement | null | undefined)[]) =>
    defineComponent({
        setup() {
            seen.push(inject(HOST_ELEMENT_PROVIDER_INJECTION_KEY)?.hostRef.value);
            return () => h('span');
        },
    });

describe('HostElementProvider', () => {
    it('knows the custom element it renders in while the tree below it sets up', () => {
        const seen: (HTMLElement | null | undefined)[] = [];
        const Probe = createProbe(seen);
        const Entry = defineComponent({
            setup: () => () =>
                h(HostElementProvider, { customElementName: 'solvimon-host-probe' }, () =>
                    h(Probe),
                ),
        });
        customElements.define('solvimon-host-probe', defineCustomElement(Entry));

        const element = document.createElement('solvimon-host-probe');
        document.body.append(element);

        expect(seen).toEqual([element]);

        element.remove();
    });

    it('falls back to the mount container outside a custom element', () => {
        const seen: (HTMLElement | null | undefined)[] = [];
        const Probe = createProbe(seen);
        let hostRef: { value: HTMLElement | null } | undefined;

        const Reader = defineComponent({
            setup() {
                hostRef = inject(HOST_ELEMENT_PROVIDER_INJECTION_KEY)?.hostRef;
                return () => h(Probe);
            },
        });

        const wrapper = mount(
            defineComponent({
                setup: () => () =>
                    h('div', [h(HostElementProvider, { customElementName: 'x' }, () => h(Reader))]),
            }),
            { attachTo: document.body },
        );

        expect(seen).toEqual([null]);
        expect(hostRef?.value).toBe(wrapper.element);

        wrapper.unmount();
    });
});
