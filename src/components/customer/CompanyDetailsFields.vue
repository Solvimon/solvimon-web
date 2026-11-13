<script setup lang="ts">
import { computed, reactive } from 'vue';
import { Button, Input, isEUCountry, useIntl } from '@solvimon/solvimon-ui';
import type { ErrorObject } from '@vuelidate/core';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { isVatNumberShown } from '@/components/customer/CheckoutForm/CheckoutForm.lib';
import TaxIDCheckNotice from '@/components/customer/CheckoutForm/TaxIDCheckNotice.vue';
import { useCustomerFormLabels } from '@/components/customer/useCustomerFormLabels';
import { useTaxIDValidationCheck } from '@/composables/useTaxIDValidationCheck';
import { asOptionalText, formControlModel } from '@/utils/formControl';

const props = defineProps<{
    errors: {
        companyLegalName?: ErrorObject[] | string;
        companyVatNumber?: ErrorObject[] | string;
    };
    /** Holds back the VIES check while the number would fail the form's own check. */
    isVatNumberInvalid?: boolean;
}>();

const model = defineModel<CheckoutFormState>({ required: true });

const { $t } = useIntl();
const labels = useCustomerFormLabels();

const fields = reactive({
    companyLegalName: formControlModel(model, 'companyLegalName', asOptionalText),
    companyVatNumber: formControlModel(model, 'companyVatNumber', asOptionalText),
});

const showVatIdInput = computed(() => isVatNumberShown(model.value));

const { isTaxIDCheckEnabled, isTaxIDCheckPending, taxIdCheckStatus, runTaxIDCheck } =
    useTaxIDValidationCheck(model);

const isCheckDisabled = computed(
    () => !isTaxIDCheckEnabled.value || isTaxIDCheckPending.value || !!props.isVatNumberInvalid,
);
</script>

<template>
    <div class="flex flex-col gap-2">
        <Input
            v-model="fields.companyLegalName"
            required
            name="legal_name"
            autocomplete="billing organization"
            :label="labels.legalNameLabel"
            :placeholder="labels.legalNamePlaceholder"
            :error="errors.companyLegalName"
        />

        <Input
            v-if="showVatIdInput"
            v-model="fields.companyVatNumber"
            name="vat_number"
            autocomplete="off"
            input-class="focus:outline-none focus:ring-0"
            :label="labels.vatNumberLabel"
            :placeholder="labels.vatNumberPlaceholder"
            :error="errors.companyVatNumber"
            suffix-class="px-2 border-l-0"
        >
            <template v-if="isEUCountry(model.country ?? '')" #suffix>
                <Button
                    type="button"
                    size="sm"
                    intent="secondary"
                    :disabled="isCheckDisabled"
                    @click="runTaxIDCheck"
                >
                    {{
                        $t({
                            defaultMessage: 'Check',
                            id: 'checkout.vat_number.check_button.label',
                            description: 'The label for the check button in the checkout form',
                        })
                    }}
                </Button>
            </template>
        </Input>

        <div v-if="taxIdCheckStatus" :class="{ 'opacity-75': isTaxIDCheckPending }">
            <TaxIDCheckNotice :status="taxIdCheckStatus" />
        </div>
    </div>
</template>
