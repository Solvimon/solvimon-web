import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { CountryCode } from '@solvimon/solvimon-types';
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
    { isShippingAddressRequired = false, isBillingInformationMandatory = true } = {},
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
                return () =>
                    h(CheckoutForm, {
                        modelValue: checkoutForm.form.value,
                        'onUpdate:modelValue': (value: CheckoutFormState) =>
                            (checkoutForm.form.value = value),
                        validation: checkoutForm.validation,
                        getIsFieldRequired: checkoutForm.getIsFieldRequired,
                        getIsShippingFieldRequired: checkoutForm.getIsShippingFieldRequired,
                        isShippingAddressRequired,
                        isBillingInformationMandatory,
                    });
            },
        }),
        { global: { stubs: { CountrySelect: true } } },
    );

    return { wrapper, checkoutForm };
};

const fieldRoot = (wrapper: Pick<ReturnType<typeof mount>, 'find'>, name: string) =>
    wrapper.find(`[data-testid="input-${name}"]`);

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

    describe('with a shipping address', () => {
        const customer = { email: 'jane@example.com', country: 'NL' as CountryCode };
        const shipped = { isShippingAddressRequired: true };

        it('names the block after what it collects', () => {
            const { wrapper } = mountForm(customer, shipped);

            expect(wrapper.text()).toContain('Shipping information');
        });

        it('asks where the order ships, country and all', () => {
            const { wrapper } = mountForm(customer, shipped);
            const shippingBlock = wrapper.find('.sv-checkout__shipping-address');

            expect(shippingBlock.exists()).toBe(true);
            expect(fieldRoot(shippingBlock, 'shipping_address_line_1').exists()).toBe(true);
            expect(fieldRoot(shippingBlock, 'shipping_postal_code').exists()).toBe(true);
            expect(fieldRoot(shippingBlock, 'shipping_city').exists()).toBe(true);
            expect(shippingBlock.find('[name="shipping_country"]').exists()).toBe(true);
            expect(wrapper.text()).toContain('Shipping address');
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

        it('asks for a phone number the carrier can reach the recipient on', async () => {
            const { wrapper, checkoutForm } = mountForm(customer, shipped);
            const phoneNumber = fieldRoot(wrapper, 'shipping_phone_number');

            expect(phoneNumber.text()).toContain('Phone number');

            await checkoutForm.validation.value.$validate();
            await flushPromises();

            expect(phoneNumber.text()).toContain('The value is required');
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
