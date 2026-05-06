import { computed, ref, type Ref } from 'vue';
import type { TaxIdValidationResult } from '@solvimon/solvimon-types';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { isEUCountry } from '@/utils/viesChecker';
import { createCustomerService } from '@/services/customer';

export function useTaxIDValidationCheck(form: Ref<CheckoutFormState>) {
    const { checkTaxID } = createCustomerService();

    const taxIdValidationData = ref<TaxIdValidationResult | undefined>(undefined);

    const taxId = computed(() => form.value.companyVatNumber?.trim() ?? '');
    const legalName = computed(() => form.value.companyLegalName ?? '');
    const countryCode = computed(() => form.value.country);

    const isTaxIDCheckPending = ref(false);

    const isSelectedCountryEU = computed(() => {
        return isEUCountry(countryCode.value ?? '');
    });

    const isTaxIDCheckEnabled = computed(() => !!(taxId.value && legalName.value && countryCode.value));

    const showViesCheckNotice = computed(() => {
        return isSelectedCountryEU.value && taxId.value;
    });

    async function runTaxIDCheck() {
        if (!isTaxIDCheckEnabled.value || !isSelectedCountryEU.value || !countryCode.value) {
            return;
        }

        isTaxIDCheckPending.value = true;

        try {
            const result = await checkTaxID({
                type: 'ORGANIZATION',
                organization: {
                    legal_name: legalName.value,
                    tax_ids: [{ id: taxId.value, type: 'GENERIC_TAX_ID' }],
                    registered_address: {
                        country: countryCode.value,
                    },
                },
            });

            if (result?.data?.length) {
                taxIdValidationData.value = result.data[0];
            } else {
                taxIdValidationData.value = undefined;
            }
        } finally {
            isTaxIDCheckPending.value = false;
        }
    }

    return {
        runTaxIDCheck,
        taxIdValidationData,
        isTaxIDCheckPending,
        isTaxIDCheckEnabled,
        showViesCheckNotice,
        isSelectedCountryEU,
    };
}
