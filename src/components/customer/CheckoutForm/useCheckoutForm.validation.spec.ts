import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import type { CountryCode } from '@solvimon/solvimon-types';
import { useCheckoutForm } from './useCheckoutForm';

const { mockTaxIdValidator } = vi.hoisted(() => ({
    mockTaxIdValidator: vi.fn((value: unknown) => !value || value === 'NL863950310B01'),
}));

vi.mock('@/services/geolocation', () => ({
    createGeoLocationService: vi.fn(() => ({ getGeoLocation: vi.fn(() => new Promise(() => {})) })),
}));

vi.mock('@solvimon/solvimon-ui/validators', () => ({
    taxId: { $validator: mockTaxIdValidator, $message: 'Invalid tax ID' },
}));

const mountForm = () => {
    let result: ReturnType<typeof useCheckoutForm> | undefined;

    mount(
        defineComponent({
            setup() {
                result = useCheckoutForm({
                    initialState: {
                        email: 'jane@example.com',
                        country: 'NL' as CountryCode,
                        companyLegalName: 'Acme B.V.',
                    },
                    onRequiredFieldChange: vi.fn(),
                });
            },
            render: () => h('div'),
        }),
    );

    return result!;
};

describe('useCheckoutForm VAT number validation', () => {
    it('rejects an invalid VAT number on a company purchase', async () => {
        const { form, validation } = mountForm();
        form.value.type = 'ORGANIZATION';
        form.value.companyVatNumber = '123';
        await nextTick();

        expect(await validation.value.$validate()).toBe(false);
        expect(validation.value.companyVatNumber.$invalid).toBe(true);
    });

    it('lets a purchase through once it is no longer a company purchase', async () => {
        const { form, validation } = mountForm();
        form.value.type = 'ORGANIZATION';
        form.value.companyVatNumber = '123';
        await nextTick();
        form.value.type = 'INDIVIDUAL';
        await nextTick();

        expect(await validation.value.$validate()).toBe(true);
    });

    it('lets a company purchase through once the country is the US', async () => {
        const { form, validation } = mountForm();
        form.value.type = 'ORGANIZATION';
        form.value.companyVatNumber = '123';
        form.value.country = 'US' as CountryCode;
        form.value.addressLine1 = 'Main Street 1';
        form.value.postalCode = '10001';
        await nextTick();

        expect(await validation.value.$validate()).toBe(true);
    });

    it('checks the VAT number again once it is shown again', async () => {
        const { form, validation } = mountForm();
        form.value.companyVatNumber = '123';
        await nextTick();
        expect(await validation.value.$validate()).toBe(true);

        form.value.type = 'ORGANIZATION';
        await nextTick();

        expect(await validation.value.$validate()).toBe(false);
    });
});

describe('useCheckoutForm legal name validation', () => {
    it('requires a legal name on a company purchase', async () => {
        const { form, validation } = mountForm();
        form.value.type = 'ORGANIZATION';
        form.value.companyLegalName = undefined;
        await nextTick();

        expect(await validation.value.$validate()).toBe(false);
        expect(validation.value.companyLegalName.$invalid).toBe(true);
    });

    it('does not ask an individual for a legal name', async () => {
        const { form, validation } = mountForm();
        form.value.companyLegalName = undefined;
        await nextTick();

        expect(await validation.value.$validate()).toBe(true);
    });
});
