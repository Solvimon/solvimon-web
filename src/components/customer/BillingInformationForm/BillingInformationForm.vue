<script setup lang="ts">
import {
    Button,
    CountrySelect,
    ErrorNotification,
    Input,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed, ref, watch } from 'vue';
import type { BillingInformationFormProps } from './BillingInformationForm.types';
import { useBillingInformationForm } from './useBillingInformationForm';
import CompanyPurchaseToggle from '@/components/customer/CompanyPurchaseToggle.vue';
import { useCustomerFormLabels } from '@/components/customer/useCustomerFormLabels';

const props = defineProps<BillingInformationFormProps>();

const { $t } = useIntl();
const labels = useCustomerFormLabels();
const { validation, form, updateInitialState, submit, hasChanges } = useBillingInformationForm({
    onSubmit: ({ customerId, payload }) => props.updateCustomer({ customerId, payload }),
});

const hasHydratedFromCustomer = ref(false);

const isCompanyPurchase = computed<boolean>(() => form.value.type === 'ORGANIZATION');
const showCompanyPurchaseToggle = computed<boolean>(() => !hasHydratedFromCustomer.value);

const companyPurchaseModel = computed({
    get: () => isCompanyPurchase.value,
    set: (value: boolean) => (form.value.type = value ? 'ORGANIZATION' : 'INDIVIDUAL'),
});

const handleSubmit = async (): Promise<void> => {
    await validation.value.$validate();
    const isValid = !validation.value.$invalid;
    if (!isValid) return;
    if (!props.customer?.id) return;
    await submit(props.customer.id);
};

watch(
    () => props.customer,
    (customer) => {
        if (!customer || hasHydratedFromCustomer.value) {
            return;
        }

        updateInitialState(customer);
        hasHydratedFromCustomer.value = true;
    },
    { immediate: true },
);
</script>

<template>
    <form @submit.prevent="handleSubmit">
        <Typography variant="heading-3" tag="h2">{{ labels.contactInformationTitle }}</Typography>

        <div class="grid grid-cols-1 gap-4">
            <Input
                v-model="form.email"
                required
                type="email"
                :label="labels.emailLabel"
                :placeholder="labels.emailPlaceholder"
                :error="validation.email?.$errors || apiError?.email"
            />

            <CountrySelect
                v-model:single-model-value="form.country"
                :label="labels.countryLabel"
                :error="apiError?.country"
            />

            <CompanyPurchaseToggle
                v-if="showCompanyPurchaseToggle"
                v-model="companyPurchaseModel"
            />

            <template v-if="isCompanyPurchase">
                <Input
                    v-model="form.companyVatNumber"
                    name="vat_number"
                    :label="labels.vatNumberLabel"
                    :placeholder="labels.vatNumberPlaceholder"
                    :error="apiError?.vat_number"
                />

                <Input
                    v-model="form.companyLegalName"
                    required
                    name="legal_name"
                    :label="labels.legalNameLabel"
                    :placeholder="labels.legalNamePlaceholder"
                    :error="apiError?.legal_name"
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
                    v-model="form.firstName"
                    name="first_name"
                    :label="
                        $t({
                            defaultMessage: 'First name',
                            id: 'checkout.first_name.label',
                            description: 'The first name of the customer in the checkout form',
                        })
                    "
                    :placeholder="
                        $t({
                            defaultMessage: 'First name...',
                            id: 'checkout.first_name.placeholder',
                            description: 'The first name of the customer in the checkout form',
                        })
                    "
                    :error="apiError?.first_name"
                />
                <Input
                    v-model="form.lastName"
                    name="last_name"
                    :label="
                        $t({
                            defaultMessage: 'Last name',
                            id: 'checkout.last_name.label',
                            description: 'The last name of the customer in the checkout form',
                        })
                    "
                    :placeholder="
                        $t({
                            defaultMessage: 'Last name...',
                            id: 'checkout.last_name.placeholder',
                            description: 'The last name of the customer in the checkout form',
                        })
                    "
                    :error="apiError?.last_name"
                />
            </div>

            <Input
                v-model="form.addressLine1"
                name="address_line_1"
                :label="labels.addressTitle"
                :placeholder="
                    $t({
                        defaultMessage: 'Address line 1...',
                        id: 'checkout.address.line1.placeholder',
                        description: 'Address line 1 of the customer address in the checkout form',
                    })
                "
                :error="apiError?.address_line_1"
            />
            <Input
                v-model="form.addressLine2"
                name="address_line_2"
                :placeholder="
                    $t({
                        defaultMessage: 'Address line 2...',
                        id: 'checkout.address.line2.placeholder',
                        description: 'Address line 2 of the customer address in the checkout form',
                    })
                "
                :error="apiError?.address_line_2"
            />
            <div class="grid grid-cols-3 gap-2">
                <Input
                    v-model="form.postalCode"
                    name="postal_code"
                    :placeholder="labels.postalCodePlaceholder"
                    :error="apiError?.postal_code"
                />
                <Input
                    v-model="form.city"
                    name="city"
                    :placeholder="labels.cityPlaceholder"
                    :error="apiError?.city"
                />
                <Input
                    v-model="form.state"
                    name="state"
                    :placeholder="labels.statePlaceholder"
                    :error="apiError?.state"
                />
            </div>
        </div>

        <ErrorNotification v-if="apiError?._generic" class="mt-4" :title="apiError._generic" />

        <Button
            type="submit"
            color="primary"
            :disabled="!hasChanges"
            :loading="isLoading"
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
