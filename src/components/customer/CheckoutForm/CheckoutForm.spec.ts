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

const mountForm = (initialState: Partial<CheckoutFormState>) => {
    let checkoutForm!: ReturnType<typeof useCheckoutForm>;

    const wrapper = mount(
        defineComponent({
            setup() {
                checkoutForm = useCheckoutForm({ initialState, onRequiredFieldChange: vi.fn() });
                return () =>
                    h(CheckoutForm, {
                        modelValue: checkoutForm.form.value,
                        'onUpdate:modelValue': (value: CheckoutFormState) =>
                            (checkoutForm.form.value = value),
                        validation: checkoutForm.validation,
                        getIsFieldRequired: checkoutForm.getIsFieldRequired,
                        isBillingInformationMandatory: true,
                    });
            },
        }),
        { global: { stubs: { CountrySelect: true } } },
    );

    return { wrapper, checkoutForm };
};

const fieldRoot = (wrapper: ReturnType<typeof mount>, name: string) =>
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
            expect(labelElement.text()).toContain(label);
        }
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
});
