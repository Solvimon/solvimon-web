import { computed, watch, type Ref } from 'vue';
import type { TaxIdValidationResult, TaxIdValidationStatus } from '@solvimon/solvimon-types';
import { isEUCountry } from '@solvimon/solvimon-ui';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { useService } from '@/composables/useService';
import { createCustomerService } from '@/services/customer';

export function useTaxIDValidationCheck(form: Ref<CheckoutFormState>) {
    const { checkTaxID } = createCustomerService();

    const {
        data,
        error,
        execute,
        settle,
        isPending: isTaxIDCheckPending,
    } = useService({ service: checkTaxID, isCollection: true });

    const taxIdValidationData = computed<TaxIdValidationResult | undefined>(() => data.value?.[0]);

    /** A check that could not be made reads as one VIES could not answer. */
    const taxIdCheckStatus = computed<TaxIdValidationStatus | undefined>(() =>
        error.value ? 'UNKNOWN' : taxIdValidationData.value?.valid,
    );

    const taxId = computed(() => form.value.companyVatNumber?.trim() ?? '');
    const legalName = computed(() => form.value.companyLegalName ?? '');
    const countryCode = computed(() => form.value.country);

    // An outcome speaks for the details it was asked about only, including one still on its way.
    watch([taxId, legalName, countryCode], () => settle([]));

    const isSelectedCountryEU = computed(() => {
        return isEUCountry(countryCode.value ?? '');
    });

    const isTaxIDCheckEnabled = computed(
        () => !!(taxId.value && legalName.value && countryCode.value),
    );

    const showViesCheckNotice = computed(() => {
        return isSelectedCountryEU.value && taxId.value;
    });

    async function runTaxIDCheck() {
        if (!isTaxIDCheckEnabled.value || !isSelectedCountryEU.value || !countryCode.value) {
            return;
        }

        try {
            await execute({
                type: 'ORGANIZATION',
                organization: {
                    legal_name: legalName.value,
                    tax_ids: [{ id: taxId.value, type: 'GENERIC_TAX_ID' }],
                    registered_address: {
                        country: countryCode.value,
                    },
                },
            });
        } catch {
            // Shown through `taxIdCheckStatus`.
        }
    }

    return {
        runTaxIDCheck,
        taxIdValidationData,
        taxIdCheckStatus,
        isTaxIDCheckPending,
        isTaxIDCheckEnabled,
        showViesCheckNotice,
        isSelectedCountryEU,
    };
}
