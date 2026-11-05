import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { CountryCode } from '@solvimon/solvimon-types';
import { ErrorHandlingProvider, IntlProvider } from '@solvimon/solvimon-ui';
import CheckoutForm from './CheckoutForm.vue';
import type { CheckoutFormState } from './CheckoutForm.types';
import { useCheckoutForm } from './useCheckoutForm';
import type { CheckoutFormDisplay } from './CheckoutForm.lib';

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
        display = undefined as CheckoutFormDisplay | undefined,
        isTypeLocked = false,
        alsoRequired = [] as (keyof CheckoutFormState)[],
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
                    display,
                    alsoRequired,
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
                                shippingAddressFormat: checkoutForm.shippingAddressFormat.value,
                                isShippingAddressRequired,
                                isBillingInformationMandatory,
                                readOnly,
                                display,
                                isTypeLocked,
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

        it('opens on the email, then the shipping address with its country first', () => {
            const { wrapper } = mountForm(customer, shipped);
            const email = fieldRoot(wrapper, 'email');
            const shippingCountry = wrapper.find('[name="shipping_country"]');
            const shippingAddress = wrapper.find('.sv-checkout__shipping-address');

            expect(wrapper.text()).toContain('Shipping information');
            expect(wrapper.find('[name="country"]').exists()).toBe(false);
            expect(email.element.compareDocumentPosition(shippingCountry.element)).toBe(
                Node.DOCUMENT_POSITION_FOLLOWING,
            );
            expect(shippingCountry.element.compareDocumentPosition(shippingAddress.element)).toBe(
                Node.DOCUMENT_POSITION_FOLLOWING,
            );
            expect(fieldRoot(shippingAddress, 'shipping_address_line_1').exists()).toBe(true);
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

        it('offers to bill where the order ships, asking no billing address meanwhile', () => {
            const { wrapper } = mountForm(customer, shipped);
            const checkbox = wrapper.find('.sv-checkout__billing-same-as-shipping');

            expect(wrapper.text()).toContain('Billing address is the same as shipping address');
            expect(
                checkbox.element.compareDocumentPosition(
                    wrapper.find('.sv-checkout__shipping-address').element,
                ),
            ).toBe(Node.DOCUMENT_POSITION_PRECEDING);
            expect(wrapper.find('.sv-checkout__billing-section').exists()).toBe(false);
        });

        it('gives a separate billing address a section of its own, without a phone number', () => {
            const { wrapper } = mountForm(
                { ...customer, billingAddressSameAsShipping: false },
                shipped,
            );
            const billingBlock = wrapper.find(
                '.sv-checkout__billing-section .sv-checkout__billing-address',
            );

            expect(fieldRoot(billingBlock, 'address_line_1').exists()).toBe(true);
            expect(billingBlock.find('[name="shipping_phone_number"]').exists()).toBe(false);
        });

        // Both addresses ask for a "Postal code" and a "City"; the group name tells them apart.
        it('names each address group for assistive technology', () => {
            const { wrapper } = mountForm(
                { ...customer, billingAddressSameAsShipping: false },
                shipped,
            );
            const groups = wrapper.findAll('fieldset');
            const groupOf = (name: string) =>
                groups.find((group) => group.find('legend').text().includes(name));

            expect(groupOf('Shipping address')?.find('[name="shipping_city"]').exists()).toBe(true);
            expect(groupOf('Billing address')?.find('[name="city"]').exists()).toBe(true);
            expect(groupOf('Billing address')?.find('[name="shipping_city"]').exists()).toBe(false);
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

        it('asks for a phone number, dialled from the shipping country', async () => {
            const { wrapper, checkoutForm } = mountForm(
                { ...customer, shippingCountry: 'NL' as CountryCode },
                shipped,
            );
            const phoneNumber = wrapper.find(
                '.sv-checkout__shipping-address .sv-checkout__shipping-phone-number',
            );

            await phoneNumber.find('input[name="shipping_phone_number"]').setValue('06 12345678');

            expect(checkoutForm.form.value.shippingPhoneNumber).toBe('+31612345678');
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

        it('says what is wrong with a postal code or phone number on its field', async () => {
            const { wrapper, checkoutForm } = mountForm(
                {
                    ...customer,
                    shippingCountry: 'NL' as CountryCode,
                    shippingPostalCode: '10000',
                    shippingPhoneNumber: '-',
                },
                shipped,
            );
            await formatsLoaded();

            await checkoutForm.validation.value.$validate();
            await flushPromises();

            expect(fieldRoot(wrapper, 'shipping_postal_code').text()).toContain(
                'Enter a postal code in the format of this country',
            );
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
    });

    describe('display of each group', () => {
        const organization = {
            type: 'ORGANIZATION' as const,
            email: 'jane@example.com',
            country: 'NL' as CountryCode,
            companyLegalName: 'Acme BV',
            companyVatNumber: 'NL863950310B01',
            addressLine1: 'Main Street 1',
            city: 'Utrecht',
        };

        it('offers every input and the type switch without a display', () => {
            const { wrapper } = mountForm(organization);

            for (const name of ['email', 'address_line_1', 'legal_name', 'vat_number']) {
                expect(fieldRoot(wrapper, name).exists()).toBe(true);
            }
            expect(wrapper.find('[name="country"]').exists()).toBe(true);
            expect(wrapper.text()).toContain('Company purchase');
        });

        it('shows a read-only group as its value, without an input', () => {
            const { wrapper } = mountForm(organization, {
                display: {
                    email: 'READ_ONLY',
                    address: 'READ_ONLY',
                    customer_details: 'READ_ONLY',
                },
            });

            for (const name of ['email', 'address_line_1', 'legal_name']) {
                expect(fieldRoot(wrapper, name).exists()).toBe(false);
            }
            expect(wrapper.find('[name="country"]').exists()).toBe(false);
            expect(wrapper.text()).toContain('jane@example.com');
            expect(wrapper.text()).toContain('Main Street 1');
            expect(wrapper.text()).toContain('Utrecht');
            expect(wrapper.text()).toContain('Netherlands');
            expect(wrapper.text()).toContain('Acme BV');
            expect(fieldRoot(wrapper, 'vat_number').exists()).toBe(true);
        });

        it('renders nothing of a hidden group', () => {
            const { wrapper } = mountForm(organization, {
                display: { email: 'HIDDEN', tax_ids: 'HIDDEN' },
            });

            expect(fieldRoot(wrapper, 'email').exists()).toBe(false);
            expect(fieldRoot(wrapper, 'vat_number').exists()).toBe(false);
            expect(wrapper.text()).not.toContain('jane@example.com');
            expect(wrapper.text()).not.toContain('NL863950310B01');
            expect(fieldRoot(wrapper, 'legal_name').exists()).toBe(true);
        });

        it('does not require a field the customer cannot edit', async () => {
            const { checkoutForm } = mountForm(
                { type: 'ORGANIZATION' },
                {
                    display: {
                        email: 'HIDDEN',
                        address: 'READ_ONLY',
                        customer_details: 'READ_ONLY',
                    },
                },
            );

            expect(await checkoutForm.validation.value.$validate()).toBe(true);
        });

        it('still requires an editable field', async () => {
            const { checkoutForm } = mountForm(
                { type: 'ORGANIZATION' },
                { display: { email: 'EDITABLE', address: 'HIDDEN', customer_details: 'HIDDEN' } },
            );

            expect(await checkoutForm.validation.value.$validate()).toBe(false);
            expect(checkoutForm.validation.value.email.$invalid).toBe(true);
            expect(checkoutForm.validation.value.country.$invalid).toBe(false);
        });

        it('asks an individual for their name once told how to show customer details', () => {
            const individual = { email: 'jane@example.com', country: 'NL' as CountryCode };

            expect(fieldRoot(mountForm(individual).wrapper, 'first_name').exists()).toBe(false);

            const { wrapper } = mountForm(individual, {
                display: { customer_details: 'EDITABLE' },
            });
            expect(fieldRoot(wrapper, 'first_name').exists()).toBe(true);
            expect(fieldRoot(wrapper, 'last_name').exists()).toBe(true);
        });

        it('marks a name part as required when it is asked for', () => {
            const { wrapper } = mountForm(
                { email: 'jane@example.com', country: 'NL' as CountryCode },
                { display: { customer_details: 'EDITABLE' }, alsoRequired: ['lastName'] },
            );
            const isRequired = (name: string) =>
                wrapper
                    .findAllComponents({ name: 'Input' })
                    .find((input) => input.props('name') === name)
                    ?.props('required');

            expect(isRequired('last_name')).toBe(true);
            expect(isRequired('first_name')).toBe(false);
        });

        it('opens the billing address when its city is required', () => {
            const { wrapper } = mountForm(
                { email: 'jane@example.com', country: 'NL' as CountryCode },
                { isBillingInformationMandatory: false, alsoRequired: ['city'] },
            );

            expect(fieldRoot(wrapper, 'city').exists()).toBe(true);
        });

        it('opens the billing address when a part of it is required', () => {
            const { wrapper } = mountForm(
                { email: 'jane@example.com', country: 'NL' as CountryCode },
                { isBillingInformationMandatory: false, alsoRequired: ['addressLine1'] },
            );

            expect(fieldRoot(wrapper, 'address_line_1').exists()).toBe(true);
            expect(wrapper.text()).not.toContain('More billing details');
        });
    });

    describe('with the type locked', () => {
        it('hides the switch and keeps the company fields of an organization', () => {
            const { wrapper } = mountForm(
                { type: 'ORGANIZATION', email: 'jane@example.com', country: 'NL' as CountryCode },
                { isTypeLocked: true },
            );

            expect(wrapper.text()).not.toContain('Company purchase');
            expect(fieldRoot(wrapper, 'legal_name').exists()).toBe(true);
        });

        it('shows no empty section for an individual with nothing to show', () => {
            const { wrapper } = mountForm(
                { email: 'jane@example.com', country: 'NL' as CountryCode },
                { isTypeLocked: true },
            );

            expect(wrapper.text()).not.toContain('Company purchase');
            expect(wrapper.findAll('section')).toHaveLength(1);
        });
    });
});
