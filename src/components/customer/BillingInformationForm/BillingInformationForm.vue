<script setup lang="ts">
import {
    Button,
    CountrySelect,
    ErrorNotification,
    Input,
    Toggle,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed, ref, watch } from 'vue';
import type { BillingInformationFormProps } from './BillingInformationForm.types';
import { useBillingInformationForm } from './useBillingInformationForm';

const props = defineProps<BillingInformationFormProps>();

const { $t } = useIntl();
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
        <Typography variant="heading-3" tag="h2">{{
            $t({
                defaultMessage: 'Customer information',
                id: 'checkout.contact_information_block.title',
                description: 'The title of the contact information block in the checkout form',
            })
        }}</Typography>

        <div class="grid grid-cols-1 gap-4">
            <Input
                v-model="form.email"
                required
                type="email"
                :label="
                    $t({
                        defaultMessage: 'Email address',
                        id: 'checkout.email_address.label',
                        description: 'The email address of the customer in the checkout form',
                    })
                "
                :placeholder="
                    $t({
                        defaultMessage: 'Email address...',
                        id: 'checkout.email_address.placeholder',
                        description: 'The email address of the customer in the checkout form',
                    })
                "
                :error="validation.email?.$errors || apiError?.email"
            />

            <CountrySelect
                v-model:single-model-value="form.country"
                :label="
                    $t({
                        defaultMessage: 'Country',
                        id: 'checkout.country.label',
                        description: 'The country of the customer in the checkout form',
                    })
                "
                :error="apiError?.country"
            />

            <Toggle
                v-if="showCompanyPurchaseToggle"
                v-model="companyPurchaseModel"
                label-position="before"
            >
                <template #inline-label>
                    <div class="flex grow flex-col">
                        <Typography tag="span">{{
                            $t({
                                defaultMessage: 'Company purchase',
                                id: 'checkout.company_purchase_toggle.title',
                                description:
                                    'The title of the company purchase toggle in the checkout',
                            })
                        }}</Typography>
                        <Typography tag="span" variant="body-xs" shade="lighter">
                            {{
                                $t({
                                    defaultMessage: 'I am purchasing on behalf of a company',
                                    id: 'checkout.company_purchase_toggle.sub_title',
                                    description:
                                        'The subtitle of the company purchase toggle in the checkout',
                                })
                            }}</Typography
                        >
                    </div>
                </template>
            </Toggle>

            <template v-if="isCompanyPurchase">
                <Input
                    v-model="form.companyVatNumber"
                    name="vat_number"
                    :label="
                        $t({
                            defaultMessage: 'VAT number',
                            id: 'checkout.vat_number.label',
                            description: 'The label for the vat number in the checkout form',
                        })
                    "
                    :placeholder="
                        $t({
                            defaultMessage: 'VAT number...',
                            id: 'checkout.vat_number.placeholder',
                            description: 'The label for the vat number in the checkout form',
                        })
                    "
                    :error="apiError?.vat_number"
                />

                <Input
                    v-model="form.companyLegalName"
                    required
                    name="legal_name"
                    :label="
                        $t({
                            defaultMessage: 'Legal entity name',
                            id: 'checkout.legal_name.label',
                            description:
                                'The legal name of the organization customer in the checkout form',
                        })
                    "
                    :placeholder="
                        $t({
                            defaultMessage: 'Legal entity name...',
                            id: 'checkout.legal_name.placeholder',
                            description:
                                'The legal name of the organization customer in the checkout form',
                        })
                    "
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
                :label="
                    $t({
                        defaultMessage: 'Billing address',
                        id: 'checkout.address.title',
                        description: 'Address line 1 of the customer address in the checkout form',
                    })
                "
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
                    :placeholder="
                        $t({
                            defaultMessage: 'Postal code...',
                            id: 'checkout.address.portal_code.placeholder',
                            description: 'Postal code of the customer address in the checkout form',
                        })
                    "
                    :error="apiError?.postal_code"
                />
                <Input
                    v-model="form.city"
                    name="city"
                    :placeholder="
                        $t({
                            defaultMessage: 'City...',
                            id: 'checkout.address.city.placeholder',
                            description: 'City of the customer address in the checkout form',
                        })
                    "
                    :error="apiError?.city"
                />
                <Input
                    v-model="form.state"
                    name="state"
                    :placeholder="
                        $t({
                            defaultMessage: 'State...',
                            id: 'checkout.address.state.placeholder',
                            description: 'State of the customer address in the checkout form',
                        })
                    "
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
