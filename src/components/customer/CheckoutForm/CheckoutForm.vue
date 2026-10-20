<script setup lang="ts">
import {
    Button,
    Checkbox,
    CountrySelect,
    Expand,
    getCountryNameByCode,
    Input,
    isEUCountry,
    isValidCountryCode,
    Label,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed, reactive, ref } from 'vue';
import type { CountryCode } from '@solvimon/solvimon-types';
import type { CheckoutFormState, CheckoutFormProps, CheckoutFormEmits } from './CheckoutForm.types';
import TaxIDCheckNotice from './TaxIDCheckNotice.vue';
import CheckoutAddressFields from './CheckoutAddressFields.vue';
import { isShippingField, isVatNumberShown, toShippingAddressDetails } from './CheckoutForm.lib';
import CompanyPurchaseToggle from '@/components/customer/CompanyPurchaseToggle.vue';
import HiddenLabelInput from '@/components/customer/HiddenLabelInput.vue';
import { useCustomerFormLabels } from '@/components/customer/useCustomerFormLabels';
import { useTaxIDValidationCheck } from '@/composables/useTaxIDValidationCheck';
import { asOptionalText, formControlModel, type SelectControlValue } from '@/utils/formControl';

const FORM_ID = 'checkout-form';

// `isValidCountryCode` answers with a plain boolean, so the narrowing is ours to state.
const isCountryCode = (value: string): value is CountryCode => isValidCountryCode(value);

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

const fields = reactive({
    email: formControlModel(model, 'email', asOptionalText),
    addressLine1: formControlModel(model, 'addressLine1', asOptionalText),
    addressLine2: formControlModel(model, 'addressLine2', asOptionalText),
    postalCode: formControlModel(model, 'postalCode', asOptionalText),
    city: formControlModel(model, 'city', asOptionalText),
    state: formControlModel(model, 'state', asOptionalText),
    companyLegalName: formControlModel(model, 'companyLegalName', asOptionalText),
    companyVatNumber: formControlModel(model, 'companyVatNumber', asOptionalText),
});

const country = computed<SelectControlValue>({
    get: () => model.value.country,
    set: (value) => {
        const code = asOptionalText(value);
        model.value.country = code !== undefined && isCountryCode(code) ? code : undefined;
    },
});

const shippingCountry = computed<SelectControlValue>({
    get: () => model.value.shippingCountry,
    set: (value) => {
        const code = asOptionalText(value);
        model.value.shippingCountry = code !== undefined && isCountryCode(code) ? code : undefined;
    },
});

const showVatIdInput = computed(() => isVatNumberShown(model.value));

const { isTaxIDCheckEnabled, isTaxIDCheckPending, taxIdCheckStatus, runTaxIDCheck } =
    useTaxIDValidationCheck(model);

const { $t } = useIntl();
const labels = useCustomerFormLabels();

const optionalSuffixFor = (isRequired: boolean): string => {
    if (isRequired) {
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

const getOptionalSuffix = (field: keyof CheckoutFormState): string =>
    optionalSuffixFor(props.getIsFieldRequired(field));

const getBillingOptionalSuffix = (field: keyof CheckoutFormState): string =>
    optionalSuffixFor(props.getIsBillingFieldRequired?.(field) ?? props.getIsFieldRequired(field));

/** A shipping field answers to the destination country, not to the one the customer is billed in. */
const getShippingOptionalSuffix = (field: keyof CheckoutFormState): string =>
    optionalSuffixFor(
        isShippingField(field)
            ? (props.getIsShippingFieldRequired?.(field) ?? false)
            : props.getIsFieldRequired(field),
    );

const readableCountryName = computed(() =>
    model.value.country ? getCountryNameByCode(model.value.country) : undefined,
);

/** Where a paid order ships, one line each, as it was sent with the payment. */
const shippingAddressLines = computed<string[]>(() => {
    const { recipient, address } = toShippingAddressDetails(
        model.value,
        '',
        props.shippingAddressFormat,
    );
    const name = recipient.individual?.name;

    return [
        recipient.organization?.attention_name ??
            [name?.first_name, name?.last_name].filter(Boolean).join(' '),
        address.line1,
        address.line2,
        [address.postal_code, address.city].filter(Boolean).join(' '),
        address.state,
        address.country && getCountryNameByCode(address.country),
    ].filter((line): line is string => !!line);
});

/** The invoice goes to the shipping address, so there is no billing address to ask for. */
const billingAddressSameAsShipping = computed({
    get: () => model.value.billingAddressSameAsShipping,
    set: (value: boolean) => {
        model.value.billingAddressSameAsShipping = value;
    },
});

/** A shipped order's first section holds where it goes, so it is named after that. */
const customerSectionTitle = computed(() =>
    props.isShippingAddressRequired
        ? $t({
              defaultMessage: 'Shipping information',
              id: 'checkout.shipping_information_block.title',
              description: 'The title of the shipping information block in the checkout form',
          })
        : labels.contactInformationTitle,
);

const shippingAddressLabel = computed(() =>
    $t({
        defaultMessage: 'Shipping address',
        id: 'checkout.shipping_address.title',
        description: 'Label above the address an order is shipped to in the checkout form',
    }),
);

const shippingCountryLabel = computed(() =>
    $t({
        defaultMessage: 'Shipping country',
        id: 'checkout.shipping_country.label',
        description: 'Label of the country an order is shipped to in the checkout form',
    }),
);

const shippingCountryPlaceholder = computed(() =>
    $t({
        defaultMessage: 'Shipping country',
        id: 'checkout.shipping_country.placeholder',
        description: 'Placeholder of the shipping country select while no country is chosen',
    }),
);
</script>

<template>
    <form :id="FORM_ID" @submit.prevent="$emit('submit', model)">
        <!-- gap-4: the same space as between the checkout's other sections -->
        <div class="grid grid-cols-1 gap-4">
            <Section :title="customerSectionTitle">
                <div v-if="readOnly" class="grid grid-cols-1 gap-2">
                    <Typography variant="body" tag="span" weight="semibold" no-spacing>
                        {{ model.email }}
                    </Typography>
                    <template v-if="isShippingAddressRequired">
                        <Typography
                            v-for="(line, index) in shippingAddressLines"
                            :key="index"
                            variant="body-sm"
                            tag="span"
                            color="subtle"
                            no-spacing
                            class="sv-checkout__shipping-address-summary"
                        >
                            {{ line }}
                        </Typography>
                    </template>
                    <Typography v-else variant="body-sm" tag="span" color="subtle" no-spacing>
                        {{ readableCountryName }}
                    </Typography>
                </div>
                <div v-else class="flex flex-col gap-2">
                    <Input
                        v-model="fields.email"
                        required
                        type="email"
                        name="email"
                        autocomplete="email"
                        :disabled="!!readOnlyEmail"
                        :label="labels.emailLabel"
                        :placeholder="labels.emailPlaceholder + getOptionalSuffix('email')"
                        :error="validation.value.email.$errors"
                    />

                    <CountrySelect
                        v-if="!isShippingAddressRequired"
                        v-model:single-model-value="country"
                        :i18n="{ placeholderDefault: labels.countryPlaceholder }"
                        required
                        name="country"
                        :label="labels.countryLabel + getOptionalSuffix('country')"
                        :error="validation.value.country.$errors"
                    >
                        <template #label-suffix>
                            <Button
                                v-if="!showBillingDetails && !isBillingInformationMandatory"
                                size="xs"
                                intent="subtle"
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
                                intent="subtle"
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
                </div>

                <Expand
                    v-if="!isShippingAddressRequired"
                    :is-open="showBillingDetails || !!isBillingInformationMandatory"
                >
                    <div v-if="showBillingDetails || isBillingInformationMandatory">
                        <div class="mt-2 flex flex-col gap-2">
                            <Input
                                v-model="fields.addressLine1"
                                name="address_line_1"
                                autocomplete="billing address-line1"
                                :label="
                                    $t({
                                        defaultMessage: 'Billing address',
                                        id: 'checkout.address.title',
                                        description:
                                            'Label of the billing address, above its first line, in the checkout and billing information forms',
                                    })
                                "
                                :placeholder="
                                    $t({
                                        defaultMessage: 'Address line 1',
                                        id: 'checkout.address.line1.placeholder',
                                        description:
                                            'Address line 1 of the customer address in the checkout form',
                                    }) + getOptionalSuffix('addressLine1')
                                "
                                required
                                :error="validation.value.addressLine1.$errors"
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
                                        description:
                                            'Address line 2 of the customer address in the checkout form',
                                    }) + getOptionalSuffix('addressLine2')
                                "
                            />
                            <div class="grid grid-cols-3 gap-2">
                                <HiddenLabelInput
                                    v-model="fields.postalCode"
                                    name="postal_code"
                                    autocomplete="billing postal-code"
                                    :label="labels.postalCodeLabel"
                                    :placeholder="
                                        labels.postalCodePlaceholder +
                                        getOptionalSuffix('postalCode')
                                    "
                                    :error="validation.value.postalCode.$errors"
                                />
                                <HiddenLabelInput
                                    v-model="fields.city"
                                    name="city"
                                    autocomplete="billing address-level2"
                                    :label="labels.cityLabel"
                                    :placeholder="
                                        labels.cityPlaceholder + getOptionalSuffix('city')
                                    "
                                />
                                <HiddenLabelInput
                                    v-model="fields.state"
                                    name="state"
                                    autocomplete="billing address-level1"
                                    :label="labels.stateLabel"
                                    :placeholder="
                                        labels.statePlaceholder + getOptionalSuffix('state')
                                    "
                                    :error="validation.value.state.$errors"
                                />
                            </div>
                        </div>
                    </div>
                </Expand>

                <fieldset v-if="isShippingAddressRequired && !readOnly" class="mt-2">
                    <legend>
                        <Label tag="span" required>{{ shippingAddressLabel }}</Label>
                    </legend>
                    <div class="flex flex-col gap-2">
                        <CountrySelect
                            v-model:single-model-value="shippingCountry"
                            :i18n="{ placeholderDefault: shippingCountryPlaceholder }"
                            required
                            label-screen-reader-only
                            name="shipping_country"
                            :label="shippingCountryLabel"
                            :error="validation.value.shippingCountry.$errors"
                        />
                        <CheckoutAddressFields
                            v-model="model"
                            variant="SHIPPING"
                            class="sv-checkout__shipping-address"
                            :get-optional-suffix="getShippingOptionalSuffix"
                            :format="shippingAddressFormat"
                            :errors="{
                                addressLine1: validation.value.shippingAddressLine1.$errors,
                                postalCode: validation.value.shippingPostalCode.$errors,
                                city: validation.value.shippingCity.$errors,
                                state: validation.value.shippingState.$errors,
                                phoneNumber: validation.value.shippingPhoneNumber.$errors,
                                lastName: validation.value.shippingLastName.$errors,
                            }"
                        />
                    </div>

                    <!-- wrapped: Checkbox passes its attributes, margin included, on to its input -->
                    <div class="mt-2">
                        <Checkbox
                            v-model="billingAddressSameAsShipping"
                            name="billing_address_same_as_shipping"
                            class="sv-checkout__billing-same-as-shipping"
                            :label="
                                $t({
                                    defaultMessage:
                                        'Billing address is the same as shipping address',
                                    id: 'checkout.billing_address_same_as_shipping.label',
                                    description:
                                        'Label of the checkbox that bills the order to the address it ships to',
                                })
                            "
                        />
                    </div>
                </fieldset>
            </Section>

            <template v-if="isShippingAddressRequired && !readOnly">
                <Section v-if="!billingAddressSameAsShipping" class="sv-checkout__billing-section">
                    <fieldset>
                        <legend>
                            <Label tag="span" required>{{ labels.addressTitle }}</Label>
                        </legend>
                        <CheckoutAddressFields
                            v-model="model"
                            variant="BILLING"
                            class="sv-checkout__billing-address"
                            with-country
                            :country-label="labels.countryLabel"
                            :get-optional-suffix="getBillingOptionalSuffix"
                            :errors="{
                                addressLine1: validation.value.addressLine1.$errors,
                                postalCode: validation.value.postalCode.$errors,
                                city: validation.value.city.$errors,
                                state: validation.value.state.$errors,
                                country: validation.value.country.$errors,
                            }"
                        />
                    </fieldset>
                </Section>
            </template>

            <Section v-if="!readOnly">
                <CompanyPurchaseToggle v-model="companyPurchaseModel" no-spacing class="!flex" />

                <Expand :is-open="isCompanyPurchase">
                    <div v-if="isCompanyPurchase">
                        <div class="mt-2 flex flex-col gap-2">
                            <Input
                                v-model="fields.companyLegalName"
                                required
                                name="legal_name"
                                autocomplete="billing organization"
                                :label="labels.legalNameLabel"
                                :placeholder="labels.legalNamePlaceholder"
                                :error="validation.value.companyLegalName.$errors"
                            />

                            <Input
                                v-if="showVatIdInput"
                                v-model="fields.companyVatNumber"
                                name="vat_number"
                                autocomplete="off"
                                input-class="focus:outline-none focus:ring-0"
                                :label="labels.vatNumberLabel"
                                :placeholder="labels.vatNumberPlaceholder"
                                :error="validation.value.companyVatNumber.$errors"
                                suffix-class="px-2 border-l-0"
                            >
                                <template v-if="isEUCountry(model.country ?? '')" #suffix>
                                    <Button
                                        type="button"
                                        size="sm"
                                        intent="secondary"
                                        :disabled="
                                            !isTaxIDCheckEnabled ||
                                            isTaxIDCheckPending ||
                                            validation.value.companyVatNumber.$invalid
                                        "
                                        @click="runTaxIDCheck"
                                    >
                                        {{
                                            $t({
                                                defaultMessage: 'Check',
                                                id: 'checkout.vat_number.check_button.label',
                                                description:
                                                    'The label for the check button in the checkout form',
                                            })
                                        }}
                                    </Button>
                                </template>
                            </Input>

                            <div
                                v-if="taxIdCheckStatus"
                                :class="{ 'opacity-75': isTaxIDCheckPending }"
                            >
                                <TaxIDCheckNotice :status="taxIdCheckStatus" />
                            </div>
                        </div>
                    </div>
                </Expand>
            </Section>
        </div>
    </form>
</template>
