import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import ShippingAddressCard from './ShippingAddressCard.vue';
import type { ShippingAddress } from '@/types/shippingAddress';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        ContextMenu: defineComponent({
            name: 'ContextMenuStub',
            props: { items: { type: Array, default: () => [] } },
            setup: (props) => () =>
                h(
                    'div',
                    { class: 'context-menu-stub' },
                    (props.items as { label: string }[]).map(({ label }) => h('span', label)),
                ),
        }),
    });
});

const individualAddress = {
    id: 'shad_1',
    is_default: true,
    recipient: {
        type: 'INDIVIDUAL',
        individual: { name: { first_name: 'Ada', last_name: 'Lovelace' } },
        phone_number: '+31612345678',
        email: 'ada@example.com',
    },
    address: { line1: 'Damrak 1', postal_code: '1012 LG', city: 'Amsterdam', country: 'NL' },
} as unknown as ShippingAddress;

describe('ShippingAddressCard', () => {
    it('names the person it ships to, with the address and phone number', () => {
        const wrapper = mount(ShippingAddressCard, { props: { address: individualAddress } });

        expect(wrapper.find('.sv-shipping-address__recipient').text()).toBe('Ada Lovelace');
        expect(wrapper.text()).toContain('Damrak 1');
        expect(wrapper.text()).toContain('Amsterdam');
        expect(wrapper.text()).toContain('Netherlands');
        expect(wrapper.find('.sv-shipping-address__phone').text()).toBe('+31612345678');
    });

    it('names an organization with whoever the parcel is marked for', () => {
        const wrapper = mount(ShippingAddressCard, {
            props: {
                address: {
                    ...individualAddress,
                    recipient: {
                        ...individualAddress.recipient,
                        type: 'ORGANIZATION',
                        individual: undefined,
                        organization: { company_name: 'Acme', attention_name: 'Goods in' },
                    },
                } as unknown as ShippingAddress,
            },
        });

        expect(wrapper.find('.sv-shipping-address__recipient').text()).toBe('Acme, Goods in');
    });

    it('marks the default only where it is asked to tell addresses apart', async () => {
        const wrapper = mount(ShippingAddressCard, { props: { address: individualAddress } });

        expect(wrapper.find('.sv-shipping-address__default').exists()).toBe(false);

        await wrapper.setProps({ showDefault: true });

        expect(wrapper.find('.sv-shipping-address__default').exists()).toBe(true);
    });

    it('offers a menu only when there is something to do with the address', async () => {
        const wrapper = mount(ShippingAddressCard, { props: { address: individualAddress } });

        expect(wrapper.find('.context-menu-stub').exists()).toBe(false);

        await wrapper.setProps({ menuItems: [{ label: 'Delete', onClick: vi.fn() }] });

        expect(wrapper.find('.context-menu-stub').text()).toBe('Delete');
    });

    it('shows only the address lines when compact', () => {
        const wrapper = mount(ShippingAddressCard, {
            props: { address: individualAddress, compact: true },
        });

        expect(wrapper.find('.sv-shipping-address__recipient').exists()).toBe(false);
        expect(wrapper.find('.sv-shipping-address__phone').exists()).toBe(false);
        expect(wrapper.text()).toContain('Damrak 1');
    });
});
