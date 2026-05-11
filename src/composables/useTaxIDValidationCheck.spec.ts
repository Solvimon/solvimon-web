import { ref } from 'vue';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { useTaxIDValidationCheck } from './useTaxIDValidationCheck';

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
        postalCode: undefined,
        city: undefined,
        state: undefined,
        seatsValues: undefined,
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
});
