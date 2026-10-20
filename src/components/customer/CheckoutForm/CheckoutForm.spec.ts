import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { CountryCode } from '@solvimon/solvimon-types';
import { ErrorHandlingProvider, IntlProvider } from '@solvimon/solvimon-ui';
import CheckoutForm from './CheckoutForm.vue';
import type { CheckoutFormState } from './CheckoutForm.types';
import { useCheckoutForm } from './useCheckoutForm';

const { mockCheckTaxID } = vi.hoisted(() => ({ mockCheckTaxID: vi.fn() }));

vi.mock('@/services/customer', () => ({
    createCustomerService: () => ({ checkTaxID: mockCheckTaxID }),
}));

vi.mock('@/services/geolocation', () => ({
    createGeoLocationService: () => ({ getGeoLocation: () => new Promise(() => {}) }),
}));

const mountForm = (
    initialState: Partial<CheckoutFormState>,
    {
        isShippingAddressRequired = false,
        isBillingInformationMandatory = true,
        readOnly = false,
    } = {},
) => {
    let checkoutForm!: ReturnType<typeof useCheckoutForm>;

    const wrapper = mount(
        defineComponent({
            setup() {
                checkoutForm = useCheckoutForm({
                    initialState,
                    onRequiredFieldChange: vi.fn(),
                    isShippingAddressRequired,
                });
                // The phone input reads the ui's own intl, which the SDK's providers set up.
                return () =>
                    h(ErrorHandlingProvider, null, () =>
                        h(IntlProvider, { locale: 'en-US' }, () =>
                            h(CheckoutForm, {
                                modelValue: checkoutForm.form.value,
                                'onUpdate:modelValue': (value: CheckoutFormState) =>
                                    (checkoutForm.form.value = value),
                                validation: checkoutForm.validation,
                                getIsFieldRequired: checkoutForm.getIsFieldRequired,
                                getIsShippingFieldRequired: checkoutForm.getIsShippingFieldRequired,
                                getIsBillingFieldRequired: checkoutForm.getIsBillingFieldRequired,
                                shippingAddressFormat: checkoutForm.shippingAddressFormat.value,
                                isShippingAddressRequired,
                                isBillingInformationMandatory,
                                readOnly,
                            }),
                        ),
                    );
            },
        }),
        { global: { stubs: { CountrySelect: true } } },
    );

    return { wrapper, checkoutForm };
};

const fieldRoot = (wrapper: Pick<ReturnType<typeof mount>, 'find'>, name: string) =>
    wrapper.find(`[data-testid="input-${name}"]`);

/** The address formats arrive with a dynamic import, which a shipped form starts on mount. */
const formatsLoaded = async () => {
    await vi.dynamicImportSettled();
    await flushPromises();
};

describe('CheckoutForm', () => {
    beforeEach(() => {
        mockCheckTaxID.mockReset();
    });

    it('shows a missing postal code on the postal code', async () => {
        const { wrapper, checkoutForm } = mountForm({
            email: 'jane@example.com',
            country: 'US' as CountryCode,
            addressLine1: 'Main Street 1',
        });

        await checkoutForm.validation.value.$validate();
        await flushPromises();

        expect(fieldRoot(wrapper, 'postal_code').text()).toContain('The value is required');
        expect(fieldRoot(wrapper, 'address_line_1').text()).not.toContain('The value is required');
    });

    it("does not show address line 1's error on the postal code", async () => {
        const { wrapper, checkoutForm } = mountForm({
            email: 'jane@example.com',
            country: 'US' as CountryCode,
            postalCode: '10001',
        });

        await checkoutForm.validation.value.$validate();
        await flushPromises();

        expect(fieldRoot(wrapper, 'address_line_1').text()).toContain('The value is required');
        expect(fieldRoot(wrapper, 'address_line_1').html()).toContain('border-red-500');
        expect(fieldRoot(wrapper, 'postal_code').html()).not.toContain('border-red-500');
    });

    it('names every address field for assistive technology', () => {
        const { wrapper } = mountForm({ email: 'jane@example.com', country: 'NL' as CountryCode });

        for (const [name, label] of [
            ['address_line_2', 'Address line 2'],
            ['postal_code', 'Postal code'],
            ['city', 'City'],
            ['state', 'State'],
        ]) {
            const input = fieldRoot(wrapper, name).find('input');
            const labelElement = wrapper.find(`label[for="${input.attributes('id')}"]`);
            expect(labelElement.text()).toBe(label);
        }
    });

    it('shows an address field error below the field rather than in a row above it', async () => {
        const { wrapper, checkoutForm } = mountForm({
            email: 'jane@example.com',
            country: 'US' as CountryCode,
            addressLine1: 'Main Street 1',
        });

        await checkoutForm.validation.value.$validate();
        await flushPromises();

        const postalCode = fieldRoot(wrapper, 'postal_code');
        expect(postalCode.find('label').exists()).toBe(false);
        expect(postalCode.html()).toContain('border-red-500');
        expect(
            postalCode.find('input').element.compareDocumentPosition(postalCode.find('p').element),
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('shows that a company purchase needs a legal name', async () => {
        const { wrapper, checkoutForm } = mountForm({
            email: 'jane@example.com',
            country: 'NL' as CountryCode,
            type: 'ORGANIZATION',
        });

        expect(await checkoutForm.validation.value.$validate()).toBe(false);
        await flushPromises();

        expect(fieldRoot(wrapper, 'legal_name').text()).toContain('The value is required');
    });

    it('says when a VAT number could not be checked, rather than calling it invalid', async () => {
        mockCheckTaxID.mockResolvedValue({
            data: [{ validation_date: '', source: 'VIES', valid: 'UNKNOWN' }],
        });
        const { wrapper } = mountForm({
            email: 'jane@example.com',
            country: 'NL' as CountryCode,
            type: 'ORGANIZATION',
            companyLegalName: 'Acme B.V.',
            companyVatNumber: 'NL863950310B01',
        });

        await fieldRoot(wrapper, 'vat_number').find('button').trigger('click');
        await flushPromises();

        expect(wrapper.text()).toContain('The VAT number could not be checked right now.');
        expect(wrapper.text()).not.toContain('VAT number is invalid.');
    });
    describe('without a shipping address', () => {
        const customer = { email: 'jane@example.com', country: 'NL' as CountryCode };

        it('asks for the billing country alongside the email, as it always has', () => {
            const { wrapper } = mountForm(customer, { isBillingInformationMandatory: false });

            expect(wrapper.text()).toContain('Customer information');
            expect(wrapper.find('[name="country"]').exists()).toBe(true);
        });

        it('offers no shipping address at all', () => {
            const { wrapper } = mountForm(customer);

            expect(wrapper.find('.sv-checkout__shipping-address').exists()).toBe(false);
            expect(wrapper.find('.sv-checkout__billing-same-as-shipping').exists()).toBe(false);
        });

        it('keeps the billing address hidden until it is asked for', () => {
            const { wrapper } = mountForm(customer, { isBillingInformationMandatory: false });

            expect(fieldRoot(wrapper, 'address_line_1').exists()).toBe(false);
        });
    });

    it('names the email and billing address for browser autofill', () => {
        const { wrapper } = mountForm({ email: 'jane@example.com', country: 'NL' as CountryCode });
        const autocomplete = (name: string) =>
            fieldRoot(wrapper, name).find('input').attributes('autocomplete');

        expect(autocomplete('email')).toBe('email');
        expect(autocomplete('address_line_1')).toBe('billing address-line1');
        expect(autocomplete('postal_code')).toBe('billing postal-code');
        expect(autocomplete('city')).toBe('billing address-level2');
    });

    describe('with a shipping address', () => {
        const customer = { email: 'jane@example.com', country: 'NL' as CountryCode };
        const shipped = { isShippingAddressRequired: true };

        it('asks for the shipping country at the top of the shipping address', () => {
            const { wrapper } = mountForm(customer, shipped);
            const email = fieldRoot(wrapper, 'email');
            const shippingCountry = wrapper.find('[name="shipping_country"]');
            const shippingAddress = wrapper.find('.sv-checkout__shipping-address');

            expect(wrapper.text()).toContain('Shipping information');
            expect(wrapper.text()).not.toContain('Customer information');
            expect(email.element.compareDocumentPosition(shippingCountry.element)).toBe(
                Node.DOCUMENT_POSITION_FOLLOWING,
            );
            expect(shippingCountry.element.compareDocumentPosition(shippingAddress.element)).toBe(
                Node.DOCUMENT_POSITION_FOLLOWING,
            );
        });

        it('shows where a paid order ships, not the billing country', () => {
            const { wrapper } = mountForm(
                {
                    ...customer,
                    country: 'US' as CountryCode,
                    shippingFirstName: 'Jane',
                    shippingLastName: 'Doe',
                    shippingAddressLine1: 'Main street 1',
                    shippingPostalCode: '1000AA',
                    shippingCity: 'Amsterdam',
                    shippingCountry: 'NL' as CountryCode,
                },
                { ...shipped, readOnly: true },
            );
            const lines = wrapper
                .findAll('.sv-checkout__shipping-address-summary')
                .map((line) => line.text());

            expect(lines).toEqual(['Jane Doe', 'Main street 1', '1000AA Amsterdam', 'Netherlands']);
            expect(wrapper.text()).not.toContain('United States');
        });

        it('offers to bill to the shipping address from the shipping address block', () => {
            const { wrapper } = mountForm(customer, shipped);
            const checkbox = wrapper.find('.sv-checkout__billing-same-as-shipping');

            expect(checkbox.exists()).toBe(true);
            expect(
                checkbox.element.compareDocumentPosition(
                    wrapper.find('.sv-checkout__shipping-address').element,
                ),
            ).toBe(Node.DOCUMENT_POSITION_PRECEDING);
            expect(wrapper.find('.sv-checkout__billing-section').exists()).toBe(false);
        });

        it('gives a separate billing address a section of its own', () => {
            const { wrapper } = mountForm(
                { ...customer, billingAddressSameAsShipping: false },
                shipped,
            );
            const billingSection = wrapper.find('.sv-checkout__billing-section');

            expect(billingSection.text()).toContain('Billing address');
            expect(billingSection.find('.sv-checkout__billing-address').exists()).toBe(true);
        });

        it('asks where the order ships', () => {
            const { wrapper } = mountForm(customer, shipped);
            const shippingBlock = wrapper.find('.sv-checkout__shipping-address');

            expect(shippingBlock.exists()).toBe(true);
            expect(fieldRoot(shippingBlock, 'shipping_address_line_1').exists()).toBe(true);
            expect(fieldRoot(shippingBlock, 'shipping_postal_code').exists()).toBe(true);
            expect(fieldRoot(shippingBlock, 'shipping_city').exists()).toBe(true);
        });

        it('does not ask for the billing country beside the email', () => {
            const { wrapper } = mountForm(customer, shipped);

            expect(wrapper.find('[name="country"]').exists()).toBe(false);
        });

        it('offers to bill the order where it ships', () => {
            const { wrapper } = mountForm(customer, shipped);

            expect(wrapper.text()).toContain('Billing address is the same as shipping address');
        });

        it('asks for no billing address while it is billed where it ships', () => {
            const { wrapper } = mountForm(customer, shipped);

            expect(wrapper.find('.sv-checkout__billing-address').exists()).toBe(false);
        });

        it('asks for one once the customer says it differs', () => {
            const { wrapper } = mountForm(
                { ...customer, billingAddressSameAsShipping: false },
                shipped,
            );
            const billingBlock = wrapper.find('.sv-checkout__billing-address');

            expect(billingBlock.exists()).toBe(true);
            expect(fieldRoot(billingBlock, 'address_line_1').exists()).toBe(true);
        });

        it('names every shipping address field for assistive technology', () => {
            const { wrapper } = mountForm(customer, shipped);

            for (const [name, label] of [
                ['shipping_address_line_1', 'Address line 1'],
                ['shipping_address_line_2', 'Address line 2'],
                ['shipping_postal_code', 'Postal code'],
                ['shipping_city', 'City'],
                ['shipping_state', 'State'],
            ]) {
                const input = fieldRoot(wrapper, name).find('input');
                const labelElement = wrapper.find(`label[for="${input.attributes('id')}"]`);
                expect(labelElement.text()).toBe(label);
            }
        });

        it('asks for a phone number the carrier can reach the recipient on, with the shipping address', async () => {
            const { wrapper, checkoutForm } = mountForm(customer, shipped);
            const shippingBlock = wrapper.find('.sv-checkout__shipping-address');
            const phoneNumber = shippingBlock.find('.sv-checkout__shipping-phone-number');

            expect(phoneNumber.text()).toContain('Phone number');

            await checkoutForm.validation.value.$validate();
            await flushPromises();

            expect(phoneNumber.text()).toContain('The value is required');
        });

        it('dials a national phone number from the shipping country', async () => {
            const { wrapper, checkoutForm } = mountForm(
                { ...customer, shippingCountry: 'NL' as CountryCode },
                shipped,
            );

            await wrapper
                .find('.sv-checkout__shipping-phone-number input[name="shipping_phone_number"]')
                .setValue('06 12345678');

            expect(checkoutForm.form.value.shippingPhoneNumber).toBe('+31612345678');
        });

        it('asks for no phone number with a separate billing address', () => {
            const { wrapper } = mountForm(
                { ...customer, billingAddressSameAsShipping: false },
                shipped,
            );
            const billingBlock = wrapper.find('.sv-checkout__billing-address');

            expect(billingBlock.exists()).toBe(true);
            expect(billingBlock.find('[name="shipping_phone_number"]').exists()).toBe(false);
        });

        it('asks who receives the parcel, by last name at least', async () => {
            const { wrapper, checkoutForm } = mountForm(customer, shipped);

            expect(
                fieldRoot(wrapper, 'shipping_first_name').find('input').attributes('placeholder'),
            ).toContain('(optional)');

            await checkoutForm.validation.value.$validate();
            await flushPromises();

            expect(fieldRoot(wrapper, 'shipping_last_name').text()).toContain(
                'The value is required',
            );
        });

        it('asks a company for a contact person instead of a name', () => {
            const { wrapper } = mountForm({ ...customer, type: 'ORGANIZATION' }, shipped);

            expect(fieldRoot(wrapper, 'shipping_attention_name').exists()).toBe(true);
            expect(fieldRoot(wrapper, 'shipping_last_name').exists()).toBe(false);
        });

        it('leaves out the postal code where the destination has none', async () => {
            const { wrapper } = mountForm(
                { ...customer, shippingCountry: 'HK' as CountryCode },
                shipped,
            );
            await formatsLoaded();

            expect(fieldRoot(wrapper, 'shipping_postal_code').exists()).toBe(false);
            expect(fieldRoot(wrapper, 'shipping_address_line_1').exists()).toBe(true);
        });

        it('says so when a postal code does not fit the destination', async () => {
            const { wrapper, checkoutForm } = mountForm(
                { ...customer, shippingCountry: 'NL' as CountryCode, shippingPostalCode: '10000' },
                shipped,
            );
            await formatsLoaded();

            await checkoutForm.validation.value.$validate();
            await flushPromises();

            expect(fieldRoot(wrapper, 'shipping_postal_code').text()).toContain(
                'Enter a postal code in the format of this country',
            );
        });

        it('says so when a phone number cannot be dialled', async () => {
            const { wrapper, checkoutForm } = mountForm(
                { ...customer, shippingPhoneNumber: '-' },
                shipped,
            );

            await checkoutForm.validation.value.$validate();
            await flushPromises();

            expect(wrapper.find('.sv-checkout__shipping-phone-number').text()).toContain(
                'Enter a phone number of 7 to 15 digits',
            );
        });

        it('names each field for browser autofill, apart from the billing address', () => {
            const { wrapper } = mountForm(
                { ...customer, billingAddressSameAsShipping: false },
                shipped,
            );
            const autocomplete = (name: string) =>
                fieldRoot(wrapper, name).find('input').attributes('autocomplete');

            expect(autocomplete('shipping_last_name')).toBe('shipping family-name');
            expect(autocomplete('shipping_address_line_1')).toBe('shipping address-line1');
            expect(autocomplete('shipping_postal_code')).toBe('shipping postal-code');
            expect(autocomplete('address_line_1')).toBe('billing address-line1');
        });

        it('shows a missing shipping postal code on that field', async () => {
            const { wrapper, checkoutForm } = mountForm(customer, shipped);

            await checkoutForm.validation.value.$validate();
            await flushPromises();

            expect(fieldRoot(wrapper, 'shipping_postal_code').text()).toContain(
                'The value is required',
            );
        });
    });
});
