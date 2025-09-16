<script setup lang="ts">
import { CountrySelect, Divider, Input, RadioGroup, Typography, useIntl } from '@solvimon/ui';
import type { CheckoutFormState, CheckoutFormProps, CheckoutFormEmits } from './CheckoutForm.types';

const FORM_ID = 'checkout-form';

defineProps<CheckoutFormProps>();
defineEmits<CheckoutFormEmits>();
const model = defineModel<CheckoutFormState>({ required: true });

const { $t } = useIntl();
</script>

<template>
    <Typography variant="heading-3" tag="h2" class="mt-2">{{
        $t({
            defaultMessage: 'Contact information',
            id: 'checkout.contact_information_block.title',
            description: 'The title of the contact information block in the checkout form',
        })
    }}</Typography>
    <div class="grid grid-cols-1 gap-4">
        <Input
            v-model="model.email"
            required
            type="email"
            :form="FORM_ID"
            :label="
                $t({
                    defaultMessage: 'Email address',
                    id: 'checkout.email_address.label',
                    description: 'The email address of the customer in the checkout form',
                })
            "
            placeholder="Your email address"
            :error="validation.value.email.$errors"
        />
        <CountrySelect
            v-model:single-model-value="model.country"
            required
            :form="FORM_ID"
            :label="
                $t({
                    defaultMessage: 'Country',
                    id: 'checkout.country.label',
                    description: 'The country of the customer in the checkout form',
                })
            "
            :error="validation.value.country.$errors"
        />
    </div>

    <slot name="default" />

    <form :id="FORM_ID" @submit.prevent="$emit('submit', model)">
        <Typography variant="heading-3" tag="h2" class="mt-6">{{
            $t({
                defaultMessage: 'Billing information',
                id: 'checkout.billing_information_block.title',
                description: 'The title of the billing information block in the checkout form',
            })
        }}</Typography>
        <div class="flex gap-4 flex-col">
            <RadioGroup
                v-model="model.type"
                name="customer_type"
                variant="pill"
                required
                :options="[
                    {
                        value: 'INDIVIDUAL',
                        label: $t({
                            defaultMessage: 'Individual',
                            id: 'checkout.customer_type.option.individual.label',
                            description:
                                'The label for the individual option in the customer type selector in the checkout form',
                        }),
                    },
                    {
                        value: 'ORGANIZATION',
                        label: $t({
                            defaultMessage: 'Organization',
                            id: 'checkout.customer_type.option.organization.label',
                            description:
                                'The label for the organization option in the customer type selector in the checkout form',
                        }),
                    },
                ]"
            />
            <div v-if="model.type === 'INDIVIDUAL'" class="grid grid-cols-3 gap-4">
                <Input
                    v-model="model.firstName"
                    name="first_name"
                    :label="
                        $t({
                            defaultMessage: 'First name',
                            id: 'checkout.first_name.label',
                            description: 'The first name of the customer in the checkout form',
                        })
                    "
                />
                <Input
                    v-model="model.infix"
                    name="infix"
                    :label="
                        $t({
                            defaultMessage: 'Infix',
                            id: 'checkout.infix.label',
                            description: 'The infix of the customer in the checkout form',
                        })
                    "
                />
                <Input
                    v-model="model.lastName"
                    name="last_name"
                    :label="
                        $t({
                            defaultMessage: 'Last name',
                            id: 'checkout.last_name.label',
                            description: 'The last name of the customer in the checkout form',
                        })
                    "
                />
            </div>
            <Input
                v-if="model.type === 'ORGANIZATION'"
                v-model="model.companyLegalName"
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
            />
            <Input
                v-model="model.addressLine1"
                name="address_line_1"
                :label="
                    $t({
                        defaultMessage: 'Address line 1',
                        id: 'checkout.address.line1.label',
                        description: 'Address line 1 of the customer address in the checkout form',
                    })
                "
            />
            <Input
                v-model="model.addressLine2"
                name="address_line_2"
                :label="
                    $t({
                        defaultMessage: 'Address line 2',
                        id: 'checkout.address.line2.label',
                        description: 'Address line 2 of the customer address in the checkout form',
                    })
                "
            />
            <div class="grid grid-cols-2 gap-4">
                <Input
                    v-model="model.postalCode"
                    name="postal_code"
                    :label="
                        $t({
                            defaultMessage: 'Postal code',
                            id: 'checkout.address.portal_code.label',
                            description: 'Postal code of the customer address in the checkout form',
                        })
                    "
                />
                <Input
                    v-model="model.city"
                    name="city"
                    :label="
                        $t({
                            defaultMessage: 'City',
                            id: 'checkout.address.city.label',
                            description: 'City of the customer address in the checkout form',
                        })
                    "
                />
                <Input
                    v-model="model.state"
                    name="state"
                    :label="
                        $t({
                            defaultMessage: 'State',
                            id: 'checkout.address.state.label',
                            description: 'State of the customer address in the checkout form',
                        })
                    "
                />
            </div>
            <template v-if="model.type === 'ORGANIZATION'">
                <Divider spacing="sm" />
                <Input
                    v-model="model.companyVatNumber"
                    name="vat_number"
                    :label="
                        $t({
                            defaultMessage: 'VAT number',
                            id: 'checkout.vat_number.label',
                            description: 'The label for the vat number in the checkout form',
                        })
                    "
                />
            </template>
        </div>

        <slot name="submit-button" />
    </form>
</template>
