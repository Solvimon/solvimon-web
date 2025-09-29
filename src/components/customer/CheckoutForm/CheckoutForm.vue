<script setup lang="ts">
import { Button, CountrySelect, Input, Toggle, Typography, useIntl } from '@solvimon/ui';
import { computed, ref } from 'vue';
import type { CheckoutFormState, CheckoutFormProps, CheckoutFormEmits } from './CheckoutForm.types';

const FORM_ID = 'checkout-form';

defineProps<CheckoutFormProps>();
defineEmits<CheckoutFormEmits>();

const showBillingDetails = ref(false);

const model = defineModel<CheckoutFormState>({ required: true });
const companyPurchaseModel = computed({
    get: () => model.value.type === 'ORGANIZATION',
    set: (value) => {
        model.value.type = value ? 'ORGANIZATION' : 'INDIVIDUAL';
    },
});

const isCompanyPurchase = computed(() => model.value.type === 'ORGANIZATION');

const { $t } = useIntl();
</script>

<template>
    <form :id="FORM_ID" @submit.prevent="$emit('submit', model)">
        <Typography variant="heading-3" tag="h2">{{
            $t({
                defaultMessage: 'Customer information',
                id: 'checkout.contact_information_block.title',
                description: 'The title of the contact information block in the checkout form',
            })
        }}</Typography>

        <div class="grid grid-cols-1 gap-4">
            <Input
                v-model="model.email"
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
                :error="validation.value.email.$errors"
            />

            <CountrySelect
                v-model:single-model-value="model.country"
                required
                :label="
                    $t({
                        defaultMessage: 'Country',
                        id: 'checkout.country.label',
                        description: 'The country of the customer in the checkout form',
                    })
                "
                :error="validation.value.country.$errors"
            >
                <template #label-suffix>
                    <Button
                        v-if="!showBillingDetails"
                        size="sm"
                        variant="ghost"
                        icon-prefix="add"
                        @click="showBillingDetails = true"
                    >
                        {{
                            $t({
                                defaultMessage: 'Add billing details',
                                description:
                                    'Label of the button in the checkout that lets you fill out all billing details',
                                id: 'checkout.billing_details.add_billing_details_button.label',
                            })
                        }}
                    </Button>
                </template>
            </CountrySelect>

            <Toggle v-model="companyPurchaseModel" label-position="before">
                <template #inline-label>
                    <div class="flex flex-col grow">
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
                            }}
                        </Typography>
                    </div>
                </template>
            </Toggle>

            <template v-if="isCompanyPurchase">
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
                    :placeholder="
                        $t({
                            defaultMessage: 'VAT number...',
                            id: 'checkout.vat_number.placeholder',
                            description: 'The label for the vat number in the checkout form',
                        })
                    "
                />

                <Input
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
                    :placeholder="
                        $t({
                            defaultMessage: 'Legal entity name...',
                            id: 'checkout.legal_name.placeholder',
                            description:
                                'The legal name of the organization customer in the checkout form',
                        })
                    "
                />
            </template>
        </div>

        <template v-if="showBillingDetails">
            <div class="flex gap-4 justify-between items-center mt-6">
                <Typography variant="heading-3" tag="h2">{{
                    $t({
                        defaultMessage: 'Billing details',
                        id: 'checkout.billing_information_block.title',
                        description:
                            'The title of the billing information block in the checkout form',
                    })
                }}</Typography>
                <Button
                    v-if="showBillingDetails"
                    size="sm"
                    variant="ghost"
                    icon-prefix="close"
                    @click="showBillingDetails = false"
                    >Remove billing details</Button
                >
            </div>

            <div class="flex gap-2 flex-col">
                <div v-if="!isCompanyPurchase" class="grid grid-cols-2 gap-2">
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
                        :placeholder="
                            $t({
                                defaultMessage: 'First name...',
                                id: 'checkout.first_name.placeholder',
                                description: 'The first name of the customer in the checkout form',
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
                        :placeholder="
                            $t({
                                defaultMessage: 'Last name...',
                                id: 'checkout.last_name.placeholder',
                                description: 'The last name of the customer in the checkout form',
                            })
                        "
                    />
                </div>

                <Input
                    v-model="model.addressLine1"
                    name="address_line_1"
                    :label="
                        $t({
                            defaultMessage: 'Billing address',
                            id: 'checkout.address.title',
                            description:
                                'Address line 1 of the customer address in the checkout form',
                        })
                    "
                    :placeholder="
                        $t({
                            defaultMessage: 'Address line 1...',
                            id: 'checkout.address.line1.placeholder',
                            description:
                                'Address line 1 of the customer address in the checkout form',
                        })
                    "
                />
                <Input
                    v-model="model.addressLine2"
                    name="address_line_2"
                    :placeholder="
                        $t({
                            defaultMessage: 'Address line 2...',
                            id: 'checkout.address.line2.placeholder',
                            description:
                                'Address line 2 of the customer address in the checkout form',
                        })
                    "
                />
                <div class="grid grid-cols-3 gap-2">
                    <Input
                        v-model="model.postalCode"
                        name="postal_code"
                        :placeholder="
                            $t({
                                defaultMessage: 'Postal code...',
                                id: 'checkout.address.portal_code.placeholder',
                                description:
                                    'Postal code of the customer address in the checkout form',
                            })
                        "
                    />
                    <Input
                        v-model="model.city"
                        name="city"
                        :placeholder="
                            $t({
                                defaultMessage: 'City...',
                                id: 'checkout.address.city.placeholder',
                                description: 'City of the customer address in the checkout form',
                            })
                        "
                    />
                    <Input
                        v-model="model.state"
                        name="state"
                        :placeholder="
                            $t({
                                defaultMessage: 'State...',
                                id: 'checkout.address.state.placeholder',
                                description: 'State of the customer address in the checkout form',
                            })
                        "
                    />
                </div>
            </div>
        </template>

        <slot name="default" />

        <slot name="submit-button" />
    </form>
</template>
