import { nextTick, ref } from 'vue';
import { useTaxIDValidationCheck } from './useTaxIDValidationCheck';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';

const mockCheckTaxID = vi.fn();
const mockIsEUCountry = vi.fn();

vi.mock('@/services/customer', () => ({
    createCustomerService: () => ({
        checkTaxID: mockCheckTaxID,
    }),
}));

vi.mock('@/utils/viesChecker', () => ({
    isEUCountry: (countryCode: string) => mockIsEUCountry(countryCode),
}));

const aResult = (valid: 'VALID' | 'NOT_VALID' | 'UNKNOWN') => ({
    data: [{ validation_date: '2026-05-06T12:41:31.431Z', source: 'VIES', valid, message: '' }],
});

const createForm = (overrides: Partial<CheckoutFormState> = {}) =>
    ref<CheckoutFormState>({
        email: 'john@example.com',
        country: 'NL',
        type: 'ORGANIZATION',
        companyLegalName: 'Acme BV',
        companyVatNumber: 'NL863950310B01',
        firstName: undefined,
        infix: undefined,
        lastName: undefined,
        addressLine1: undefined,
        addressLine2: undefined,
        shippingAddressLine1: undefined,
        shippingAddressLine2: undefined,
        shippingPostalCode: undefined,
        shippingCity: undefined,
        shippingState: undefined,
        shippingCountry: undefined,
        billingAddressSameAsShipping: true,
        postalCode: undefined,
        city: undefined,
        state: undefined,
        seatsValues: undefined,
        unitsValues: undefined,
        enabledPricingIds: undefined,
        ...overrides,
    });

describe('useTaxIDValidationCheck', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsEUCountry.mockReturnValue(true);
    });

    it('enables tax id check when required fields are present', () => {
        const form = createForm();
        const composable = useTaxIDValidationCheck(form);

        expect(composable.isTaxIDCheckEnabled.value).toBe(true);
        expect(composable.isSelectedCountryEU.value).toBe(true);
        expect(composable.showViesCheckNotice.value).toBeTruthy();
    });

    it('does not call service when selected country is not in EU', async () => {
        mockIsEUCountry.mockReturnValue(false);

        const form = createForm({ country: 'US' as CheckoutFormState['country'] });
        const composable = useTaxIDValidationCheck(form);

        await composable.runTaxIDCheck();

        expect(mockCheckTaxID).not.toHaveBeenCalled();
        expect(composable.taxIdValidationData.value).toBeUndefined();
    });

    it('stores first validation item from response', async () => {
        const form = createForm();

        mockCheckTaxID.mockResolvedValue({
            data: [
                {
                    id: 'NL863950310B01',
                    validation_date: '2026-05-06T12:41:31.431Z',
                    source: 'VIES',
                    valid: 'VALID',
                    message: '',
                },
            ],
        });

        const composable = useTaxIDValidationCheck(form);

        await composable.runTaxIDCheck();

        expect(mockCheckTaxID).toHaveBeenCalledTimes(1);
        expect(mockCheckTaxID).toHaveBeenCalledWith({
            type: 'ORGANIZATION',
            organization: {
                legal_name: 'Acme BV',
                tax_ids: [{ id: 'NL863950310B01', type: 'GENERIC_TAX_ID' }],
                registered_address: { country: 'NL' },
            },
        });
        expect(composable.taxIdValidationData.value).toMatchObject({
            valid: 'VALID',
            source: 'VIES',
        });
        expect(composable.isTaxIDCheckPending.value).toBe(false);
    });

    it.each(['companyVatNumber', 'country', 'companyLegalName'] as const)(
        'clears the outcome once the %s changes',
        async (field) => {
            mockCheckTaxID.mockResolvedValue(aResult('VALID'));
            const form = createForm();
            const composable = useTaxIDValidationCheck(form);
            await composable.runTaxIDCheck();
            expect(composable.taxIdCheckStatus.value).toBe('VALID');

            form.value = {
                ...form.value,
                [field]: field === 'country' ? 'BE' : `${form.value[field]}X`,
            };
            await nextTick();

            expect(composable.taxIdCheckStatus.value).toBeUndefined();
            expect(composable.taxIdValidationData.value).toBeUndefined();
        },
    );

    it('drops the outcome of a check made for details that have since changed', async () => {
        let answer!: (value: ReturnType<typeof aResult>) => void;
        mockCheckTaxID.mockReturnValue(new Promise((resolve) => (answer = resolve)));
        const form = createForm();
        const composable = useTaxIDValidationCheck(form);

        const check = composable.runTaxIDCheck();
        form.value.companyVatNumber = 'NL000000000B00';
        await nextTick();
        answer(aResult('VALID'));
        await check;

        expect(composable.taxIdCheckStatus.value).toBeUndefined();
        expect(composable.isTaxIDCheckPending.value).toBe(false);
    });

    it('passes on that VIES could not answer', async () => {
        mockCheckTaxID.mockResolvedValue(aResult('UNKNOWN'));
        const composable = useTaxIDValidationCheck(createForm());

        await composable.runTaxIDCheck();

        expect(composable.taxIdCheckStatus.value).toBe('UNKNOWN');
    });

    it('reads a failed check as one that could not be answered, without rejecting', async () => {
        mockCheckTaxID.mockRejectedValue(new Error('Service unavailable'));
        const composable = useTaxIDValidationCheck(createForm());

        await expect(composable.runTaxIDCheck()).resolves.toBeUndefined();

        expect(composable.taxIdCheckStatus.value).toBe('UNKNOWN');
        expect(composable.isTaxIDCheckPending.value).toBe(false);
    });
});
