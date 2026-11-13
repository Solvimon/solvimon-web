import ShippingAddressFormVue from './ShippingAddressForm.entry.vue';
import { createSolvimonElement } from '@/utils/customElements';

export const { define: defineSolvimonShippingAddressForm } = createSolvimonElement(
    ShippingAddressFormVue,
    'shipping-address-form',
);
