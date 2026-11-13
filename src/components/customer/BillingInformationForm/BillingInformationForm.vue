<script setup lang="ts">
import { Button, ErrorNotification, Input, Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed, reactive, ref, watch } from 'vue';
import type {
    BillingInformationFormEmits,
    BillingInformationFormProps,
} from './BillingInformationForm.types';
import { getBillingInformationFormApiErrors } from './BillingInformationForm.lib';
import { useBillingInformationForm } from './useBillingInformationForm';
import CheckoutAddressFields from '@/components/customer/CheckoutForm/CheckoutAddressFields.vue';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import CompanyDetailsFields from '@/components/customer/CompanyDetailsFields.vue';
import { useCustomerFormLabels } from '@/components/customer/useCustomerFormLabels';
import { asOptionalText, formControlModel } from '@/utils/formControl';

const props = defineProps<BillingInformationFormProps>();
const emit = defineEmits<BillingInformationFormEmits>();

const { $t } = useIntl();
const labels = useCustomerFormLabels();
const { validation, form, updateInitialState, submit, hasChanges, isRequired } =
    useBillingInformationForm({
        onSubmit: ({ customerId, payload }) => props.updateCustomer({ customerId, payload }),
    });

const fields = reactive({
    email: formControlModel(form, 'email', asOptionalText),
    firstName: formControlModel(form, 'firstName', asOptionalText),
    lastName: formControlModel(form, 'lastName', asOptionalText),
});

type ValidatedField =
    | 'email'
    | 'country'
    | 'addressLine1'
    | 'postalCode'
    | 'city'
    | 'state'
    | 'companyLegalName'
    | 'companyVatNumber';

const isCompanyPurchase = computed<boolean>(() => form.value.type === 'ORGANIZATION');

const apiErrors = computed(() =>
    getBillingInformationFormApiErrors(props.apiError, [
        'email',
        'country',
        'addressLine1',
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

const getOptionalSuffix = (field: keyof CheckoutFormState): string =>
    isRequired(field)
        ? ''
        : ' ' +
          $t({
              defaultMessage: '(optional)',
              id: 'checkout.optional_suffix.label',
              description: 'The suffix for optional fields in the checkout form',
          });

const isSubmitting = ref(false);

/** Whether the changes were stored. */
const handleSubmit = async (): Promise<boolean> => {
    if (isSubmitting.value || !props.customer?.id) return false;

    isSubmitting.value = true;

    try {
        if (!(await validation.value.$validate())) return false;

        updateInitialState(await submit(props.customer.id));
        validation.value.$reset();
        emit('saved');
        return true;
    } catch {
        // Shown through `apiError`.
        return false;
    } finally {
        isSubmitting.value = false;
    }
};

defineExpose({ submit: handleSubmit, isSubmitting, hasChanges });

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
        <Typography v-if="!hideContactHeading" variant="heading-3" tag="h2">{{
            labels.contactInformationTitle
        }}</Typography>

        <div class="grid grid-cols-1 gap-2">
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

            <CompanyDetailsFields
                v-if="isCompanyPurchase"
                v-model="form"
                :errors="{
                    companyLegalName: getError('companyLegalName'),
                    companyVatNumber: getError('companyVatNumber'),
                }"
                :is-vat-number-invalid="validation.companyVatNumber.$invalid"
            />
        </div>

        <Typography variant="heading-3" tag="h2" class="mt-6">{{
            $t({
                defaultMessage: 'Billing details',
                id: 'checkout.billing_information_block.title',
                description: 'The title of the billing information block in the checkout form',
            })
        }}</Typography>

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

            <CheckoutAddressFields
                v-model="form"
                variant="BILLING"
                with-country
                :country-label="labels.countryLabel"
                :get-optional-suffix="getOptionalSuffix"
                :errors="{
                    addressLine1: getError('addressLine1'),
                    postalCode: getError('postalCode'),
                    city: getError('city'),
                    state: getError('state'),
                    country: getError('country'),
                }"
            />
        </div>

        <ErrorNotification v-if="apiErrors.generic" class="mt-4" :title="apiErrors.generic" />

        <Button
            v-if="!hideSubmitButton"
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
