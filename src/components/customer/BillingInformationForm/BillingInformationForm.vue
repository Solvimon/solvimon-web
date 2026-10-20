<script setup lang="ts">
import {
    Button,
    CountrySelect,
    ErrorNotification,
    Input,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed, reactive, ref, watch } from 'vue';
import type { BillingInformationFormProps } from './BillingInformationForm.types';
import { getBillingInformationFormApiErrors } from './BillingInformationForm.lib';
import { useBillingInformationForm } from './useBillingInformationForm';
import HiddenLabelInput from '@/components/customer/HiddenLabelInput.vue';
import { useCustomerFormLabels } from '@/components/customer/useCustomerFormLabels';
import {
    asOptionalText,
    asText,
    formControlModel,
    type SelectControlValue,
} from '@/utils/formControl';

const props = defineProps<BillingInformationFormProps>();

const { $t } = useIntl();
const labels = useCustomerFormLabels();
const { validation, form, updateInitialState, submit, hasChanges } = useBillingInformationForm({
    onSubmit: ({ customerId, payload }) => props.updateCustomer({ customerId, payload }),
});

const fields = reactive({
    email: formControlModel(form, 'email', asText),
    companyVatNumber: formControlModel(form, 'companyVatNumber', asOptionalText),
    companyLegalName: formControlModel(form, 'companyLegalName', asOptionalText),
    firstName: formControlModel(form, 'firstName', asOptionalText),
    lastName: formControlModel(form, 'lastName', asOptionalText),
    addressLine1: formControlModel(form, 'addressLine1', asText),
    addressLine2: formControlModel(form, 'addressLine2', asOptionalText),
    postalCode: formControlModel(form, 'postalCode', asText),
    city: formControlModel(form, 'city', asText),
    state: formControlModel(form, 'state', asOptionalText),
});

const country = computed<SelectControlValue>({
    get: () => form.value.country,
    set: (value) => {
        form.value.country = asText(value);
    },
});

type ValidatedField =
    | 'email'
    | 'country'
    | 'addressLine1'
    | 'postalCode'
    | 'state'
    | 'companyLegalName'
    | 'companyVatNumber';

const isCompanyPurchase = computed<boolean>(() => form.value.type === 'ORGANIZATION');

const apiErrors = computed(() =>
    getBillingInformationFormApiErrors(props.apiError, [
        'email',
        'country',
        'addressLine1',
        'addressLine2',
        'postalCode',
        'city',
        'state',
        ...(isCompanyPurchase.value
            ? (['companyLegalName', 'companyVatNumber'] as const)
            : (['firstName', 'lastName'] as const)),
    ]),
);

// The client-side error first: the API one describes a value that has since been edited.
const getError = (field: ValidatedField) =>
    validation.value[field].$errors.length
        ? validation.value[field].$errors
        : apiErrors.value.fields[field];

const isSubmitting = ref(false);

const handleSubmit = async (): Promise<void> => {
    if (isSubmitting.value || !props.customer?.id) return;

    isSubmitting.value = true;

    try {
        if (!(await validation.value.$validate())) return;

        updateInitialState(await submit(props.customer.id));
        validation.value.$reset();
    } catch {
        // Shown through `apiError`.
    } finally {
        isSubmitting.value = false;
    }
};

watch(
    () => props.customer,
    (customer) => {
        if (customer && !hasChanges.value) {
            updateInitialState(customer);
        }
    },
    { immediate: true },
);
</script>

<template>
    <form @submit.prevent="handleSubmit">
        <Typography variant="heading-3" tag="h2">{{ labels.contactInformationTitle }}</Typography>

        <div class="grid grid-cols-1 gap-4">
            <Input
                v-model="fields.email"
                required
                type="email"
                name="email"
                autocomplete="email"
                :label="labels.emailLabel"
                :placeholder="labels.emailPlaceholder"
                :error="getError('email')"
            />

            <CountrySelect
                v-model:single-model-value="country"
                :i18n="{ placeholderDefault: labels.countryPlaceholder }"
                :label="labels.countryLabel"
                :error="getError('country')"
            />

            <template v-if="isCompanyPurchase">
                <Input
                    v-model="fields.companyVatNumber"
                    name="vat_number"
                    autocomplete="off"
                    :label="labels.vatNumberLabel"
                    :placeholder="labels.vatNumberPlaceholder"
                    :error="getError('companyVatNumber')"
                />

                <Input
                    v-model="fields.companyLegalName"
                    required
                    name="legal_name"
                    autocomplete="billing organization"
                    :label="labels.legalNameLabel"
                    :placeholder="labels.legalNamePlaceholder"
                    :error="getError('companyLegalName')"
                />
            </template>
        </div>

        <div class="mt-6 flex items-center justify-between gap-4">
            <Typography variant="heading-3" tag="h2">{{
                $t({
                    defaultMessage: 'Billing details',
                    id: 'checkout.billing_information_block.title',
                    description: 'The title of the billing information block in the checkout form',
                })
            }}</Typography>
        </div>

        <div class="flex flex-col gap-2">
            <div v-if="!isCompanyPurchase" class="grid grid-cols-2 gap-2">
                <Input
                    v-model="fields.firstName"
                    name="first_name"
                    autocomplete="billing given-name"
                    :label="
                        $t({
                            defaultMessage: 'First name',
                            id: 'checkout.first_name.label',
                            description: 'The first name of the customer in the checkout form',
                        })
                    "
                    :placeholder="
                        $t({
                            defaultMessage: 'First name',
                            id: 'checkout.first_name.placeholder',
                            description: 'The first name of the customer in the checkout form',
                        })
                    "
                    :error="apiErrors.fields.firstName"
                />
                <Input
                    v-model="fields.lastName"
                    name="last_name"
                    autocomplete="billing family-name"
                    :label="
                        $t({
                            defaultMessage: 'Last name',
                            id: 'checkout.last_name.label',
                            description: 'The last name of the customer in the checkout form',
                        })
                    "
                    :placeholder="
                        $t({
                            defaultMessage: 'Last name',
                            id: 'checkout.last_name.placeholder',
                            description: 'The last name of the customer in the checkout form',
                        })
                    "
                    :error="apiErrors.fields.lastName"
                />
            </div>

            <Input
                v-model="fields.addressLine1"
                name="address_line_1"
                autocomplete="billing address-line1"
                :label="labels.addressTitle"
                :placeholder="
                    $t({
                        defaultMessage: 'Address line 1',
                        id: 'checkout.address.line1.placeholder',
                        description: 'Address line 1 of the customer address in the checkout form',
                    })
                "
                :error="getError('addressLine1')"
            />
            <HiddenLabelInput
                v-model="fields.addressLine2"
                name="address_line_2"
                autocomplete="billing address-line2"
                :label="labels.addressLine2Label"
                :placeholder="
                    $t({
                        defaultMessage: 'Address line 2',
                        id: 'checkout.address.line2.placeholder',
                        description: 'Address line 2 of the customer address in the checkout form',
                    })
                "
                :error="apiErrors.fields.addressLine2"
            />
            <div class="grid grid-cols-3 gap-2">
                <HiddenLabelInput
                    v-model="fields.postalCode"
                    name="postal_code"
                    autocomplete="billing postal-code"
                    :label="labels.postalCodeLabel"
                    :placeholder="labels.postalCodePlaceholder"
                    :error="getError('postalCode')"
                />
                <HiddenLabelInput
                    v-model="fields.city"
                    name="city"
                    autocomplete="billing address-level2"
                    :label="labels.cityLabel"
                    :placeholder="labels.cityPlaceholder"
                    :error="apiErrors.fields.city"
                />
                <HiddenLabelInput
                    v-model="fields.state"
                    name="state"
                    autocomplete="billing address-level1"
                    :label="labels.stateLabel"
                    :placeholder="labels.statePlaceholder"
                    :error="getError('state')"
                />
            </div>
        </div>

        <ErrorNotification v-if="apiErrors.generic" class="mt-4" :title="apiErrors.generic" />

        <Button
            type="submit"
            intent="primary"
            :disabled="!hasChanges"
            :loading="isLoading || isSubmitting"
            class="mt-4"
            >{{
                $t({
                    defaultMessage: 'Save changes',
                    id: 'billing_information_form.submit_button.label',
                    description: 'The label for the submit button of the billing information form',
                })
            }}</Button
        >
    </form>
</template>
