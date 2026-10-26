import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { ErrorHandlingProvider, IntlProvider } from '@solvimon/solvimon-ui';
import CheckoutAddressFields from './CheckoutAddressFields.vue';
import type { CheckoutFormState } from './CheckoutForm.types';
import { getInitialState } from './useCheckoutForm';

const mountFields = (props: { countryBeforeAddress?: boolean } = {}) =>
    mount(
        defineComponent({
            setup() {
                const form = ref<CheckoutFormState>(
                    getInitialState({ type: 'INDIVIDUAL', shippingCountry: 'NL' }),
                );
                // The phone input reads the ui's own intl, which the SDK's providers set up.
                return () =>
                    h(ErrorHandlingProvider, null, () =>
                        h(IntlProvider, { locale: 'en-US' }, () =>
                            h(CheckoutAddressFields, {
                                modelValue: form.value,
                                'onUpdate:modelValue': (value: CheckoutFormState) =>
                                    (form.value = value),
                                variant: 'SHIPPING',
                                withCountry: true,
                                getOptionalSuffix: () => '',
                                ...props,
                            }),
                        ),
                    );
            },
        }),
        { global: { stubs: { CountrySelect: { template: '<div class="country-select" />' } } } },
    );

/** Where each field sits in the rendered markup, in the order the customer meets them. */
const positions = (wrapper: ReturnType<typeof mountFields>) => {
    const html = wrapper.html();
    return {
        country: html.indexOf('country-select'),
        lastName: html.indexOf('name="shipping_last_name"'),
        addressLine1: html.indexOf('name="shipping_address_line_1"'),
    };
};

describe('CheckoutAddressFields', () => {
    it('starts with the country', () => {
        const { country, lastName } = positions(mountFields());

        expect(country).toBeGreaterThan(-1);
        expect(country).toBeLessThan(lastName);
    });

    it('puts the country between the recipient and the address lines when asked', () => {
        const wrapper = mountFields({ countryBeforeAddress: true });
        const { country, lastName, addressLine1 } = positions(wrapper);

        expect(wrapper.findAll('.country-select')).toHaveLength(1);
        expect(country).toBeGreaterThan(lastName);
        expect(country).toBeLessThan(addressLine1);
    });
});
