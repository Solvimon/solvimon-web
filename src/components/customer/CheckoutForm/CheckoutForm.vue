<script setup lang="ts">
import {
    Button,
    CountrySelect,
    Expand,
    getCountryNameByCode,
    Input,
    Section,
    Toggle,
    Typography,
    useIntl,
} from '@solvimon/ui';
import { computed, ref } from 'vue';
import type { CheckoutFormState, CheckoutFormProps, CheckoutFormEmits } from './CheckoutForm.types';

const FORM_ID = 'checkout-form';

const props = defineProps<CheckoutFormProps>();
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

const showVatIdInput = computed(() => model.value.country !== 'US');

const { $t } = useIntl();

const getOptionalSuffix = (field: keyof CheckoutFormState): string => {
    if (props.getIsFieldRequired(field)) {
        return '';
    }

    return (
        ' ' +
        $t({
            defaultMessage: '(optional)',
            id: 'checkout.optional_suffix.label',
            description: 'The suffix for optional fields in the checkout form',
        })
    );
};

const readableCountryName = computed(() =>
    model.value.country ? getCountryNameByCode(model.value.country) : undefined,
);
</script>

<template>
    <form :id="FORM_ID" @submit.prevent="$emit('submit', model)">
        <div class="grid grid-cols-1 gap-1">
            <Section
                :title="
                    $t({
                        defaultMessage: 'Customer information',
                        id: 'checkout.contact_information_block.title',
                        description:
                            'The title of the contact information block in the checkout form',
                    })
                "
            >
                <div class="grid grid-cols-1 gap-2">
                    <template v-if="readOnly">
                        <Typography variant="body" tag="span" weight="semibold" no-spacing>{{
                            model.email
                        }}</Typography>
                        <Typography variant="body-sm" tag="span" shade="lighter" no-spacing>{{
                            readableCountryName
                        }}</Typography>
                    </template>
                    <template v-else>
                        <Input
                            v-model="model.email"
                            required
                            type="email"
                            name="email"
                            :disabled="!!readOnlyEmail"
                            :label="
                                $t({
                                    defaultMessage: 'Email address',
                                    id: 'checkout.email_address.label',
                                    description:
                                        'The email address of the customer in the checkout form',
                                })
                            "
                            :placeholder="
                                $t({
                                    defaultMessage: 'Email address...',
                                    id: 'checkout.email_address.placeholder',
                                    description:
                                        'The email address of the customer in the checkout form',
                                }) + getOptionalSuffix('email')
                            "
                            :error="validation.value.email.$errors"
                        />

                        <CountrySelect
                            v-model:single-model-value="model.country"
                            required
                            name="country"
                            :label="
                                $t({
                                    defaultMessage: 'Billing country',
                                    id: 'checkout.country.label',
                                    description: 'The country of the customer in the checkout form',
                                }) + getOptionalSuffix('country')
                            "
                            :error="validation.value.country.$errors"
                        >
                            <template #label-suffix>
                                <Button
                                    v-if="!showBillingDetails && !isBillingInformationMandatory"
                                    size="xs"
                                    variant="ghost"
                                    icon-prefix="add"
                                    class="py-0.5"
                                    @click="showBillingDetails = true"
                                >
                                    {{
                                        $t({
                                            defaultMessage: 'More billing details',
                                            description:
                                                'Label of the button in the checkout that lets you fill out all billing details',
                                            id: 'checkout.billing_details.add_billing_details_button.label',
                                        })
                                    }}
                                </Button>
                                <Button
                                    v-if="showBillingDetails && !isBillingInformationMandatory"
                                    size="sm"
                                    variant="ghost"
                                    icon-prefix="close"
                                    class="py-0.5"
                                    @click="showBillingDetails = false"
                                    >{{
                                        $t({
                                            defaultMessage: 'Remove billing details',
                                            id: 'checkout.billing_details.remove_billing_details_button.label',
                                            description:
                                                'Label of the button in the checkout that lets you remove the billing details',
                                        })
                                    }}</Button
                                >
                            </template>
                        </CountrySelect>
                    </template>
                </div>

                <Expand>
                    <div v-if="showBillingDetails || isBillingInformationMandatory">
                        <div class="flex gap-3 flex-col mt-2">
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
                                    }) + getOptionalSuffix('addressLine1')
                                "
                                required
                                :error="validation.value.addressLine1.$errors"
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
                                    }) + getOptionalSuffix('addressLine2')
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
                                        }) + getOptionalSuffix('postalCode')
                                    "
                                    :error="validation.value.addressLine1.$errors"
                                />
                                <Input
                                    v-model="model.city"
                                    name="city"
                                    :placeholder="
                                        $t({
                                            defaultMessage: 'City...',
                                            id: 'checkout.address.city.placeholder',
                                            description:
                                                'City of the customer address in the checkout form',
                                        }) + getOptionalSuffix('city')
                                    "
                                />
                                <Input
                                    v-model="model.state"
                                    name="state"
                                    :placeholder="
                                        $t({
                                            defaultMessage: 'State...',
                                            id: 'checkout.address.state.placeholder',
                                            description:
                                                'State of the customer address in the checkout form',
                                        }) + getOptionalSuffix('state')
                                    "
                                    :error="validation.value.state.$errors"
                                />
                            </div>
                        </div>
                    </div>
                </Expand>
            </Section>

            <Section v-if="!readOnly">
                <Toggle
                    v-model="companyPurchaseModel"
                    no-spacing
                    label-position="before"
                    class="!flex"
                >
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

                <Expand>
                    <div v-if="isCompanyPurchase">
                        <div class="grid grid-cols-1 gap-3 mt-4">
                            <Input
                                v-if="showVatIdInput"
                                v-model="model.companyVatNumber"
                                name="vat_number"
                                :label="
                                    $t({
                                        defaultMessage: 'VAT number',
                                        id: 'checkout.vat_number.label',
                                        description:
                                            'The label for the vat number in the checkout form',
                                    })
                                "
                                :placeholder="
                                    $t({
                                        defaultMessage: 'VAT number...',
                                        id: 'checkout.vat_number.placeholder',
                                        description:
                                            'The label for the vat number in the checkout form',
                                    })
                                "
                                :error="validation.value.companyVatNumber.$errors"
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
                        </div>
                    </div>
                </Expand>
            </Section>
        </div>
    </form>
</template>
