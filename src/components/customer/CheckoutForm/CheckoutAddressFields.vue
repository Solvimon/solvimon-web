<script setup lang="ts">
import { computed, reactive } from 'vue';
import { CountrySelect, isValidCountryCode, PhoneInput, useIntl } from '@solvimon/solvimon-ui';
import type { CountryCode } from '@solvimon/solvimon-types';
import type { ErrorObject } from '@vuelidate/core';
import type { CheckoutAddressFieldsProps } from './CheckoutAddressFields.types';
import type { CheckoutFormState } from './CheckoutForm.types';
import { ADDRESS_KEYS, getAddressParts, type AddressPart } from './CheckoutForm.lib';
import HiddenLabelInput from '@/components/customer/HiddenLabelInput.vue';
import { useCustomerFormLabels } from '@/components/customer/useCustomerFormLabels';
import { asOptionalText, formControlModel, type SelectControlValue } from '@/utils/formControl';

// `isValidCountryCode` answers with a plain boolean, so the narrowing is ours to state.
const isCountryCode = (value: string): value is CountryCode => isValidCountryCode(value);

const GRID_COLUMNS: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
};

const props = defineProps<CheckoutAddressFieldsProps>();

const model = defineModel<CheckoutFormState>({ required: true });

const { $t } = useIntl();
const labels = useCustomerFormLabels();

const keys = ADDRESS_KEYS[props.variant];
const isShipping = props.variant === 'SHIPPING';
// The input names and `autocomplete` sections keep the two addresses apart for browser autofill.
const namePrefix = isShipping ? 'shipping_' : '';
const section = props.variant.toLowerCase();

const fields = reactive({
    addressLine1: formControlModel(model, keys.line1, asOptionalText),
    addressLine2: formControlModel(model, keys.line2, asOptionalText),
    postalCode: formControlModel(model, keys.postalCode, asOptionalText),
    city: formControlModel(model, keys.city, asOptionalText),
    state: formControlModel(model, keys.state, asOptionalText),
    firstName: formControlModel(model, 'shippingFirstName', asOptionalText),
    lastName: formControlModel(model, 'shippingLastName', asOptionalText),
    attentionName: formControlModel(model, 'shippingAttentionName', asOptionalText),
});

const country = computed<SelectControlValue>({
    get: () => model.value[keys.country],
    set: (value) => {
        const code = asOptionalText(value);
        model.value[keys.country] = code !== undefined && isCountryCode(code) ? code : undefined;
    },
});

/** PhoneInput models a missing number as `null`; the form state as `undefined`. */
const phoneNumber = computed<string | null>({
    get: () => model.value.shippingPhoneNumber ?? null,
    set: (value) => {
        model.value.shippingPhoneNumber = value ?? undefined;
    },
});

const shownParts = computed(() => new Set(getAddressParts(isShipping ? props.format : undefined)));

const localityColumns = computed(
    () =>
        GRID_COLUMNS[
            (['postalCode', 'city', 'state'] as const).filter((part) => shownParts.value.has(part))
                .length
        ],
);

const isCompany = computed(() => model.value.type === 'ORGANIZATION');

const suffix = (part: AddressPart) => props.getOptionalSuffix(keys[part]);

const localize = (errors?: ErrorObject[]): ErrorObject[] | undefined =>
    errors?.map((error) => {
        if (error.$validator === 'postalCodeFormat') {
            return {
                ...error,
                $message: $t({
                    defaultMessage: 'Enter a postal code in the format of this country',
                    id: 'checkout.postal_code.invalid',
                    description:
                        "Error under a shipping or billing postal code that does not match its country's format",
                }),
            };
        }
        if (error.$validator === 'phoneNumberFormat') {
            return {
                ...error,
                $message: $t({
                    defaultMessage: 'Enter a phone number of 7 to 15 digits',
                    id: 'checkout.shipping_phone_number.invalid',
                    description:
                        'Error under a shipping phone number with characters other than digits and separators, or too few or many digits',
                }),
            };
        }
        return error;
    });
</script>

<template>
    <div class="sv-checkout-address-fields flex flex-col gap-2">
        <CountrySelect
            v-if="withCountry"
            v-model:single-model-value="country"
            label-screen-reader-only
            :i18n="{ placeholderDefault: labels.countryPlaceholder }"
            required
            :label="countryLabel ?? labels.countryLabel"
            :name="`${namePrefix}country`"
            :error="errors?.country"
        />
        <template v-if="isShipping">
            <HiddenLabelInput
                v-if="isCompany"
                v-model="fields.attentionName"
                name="shipping_attention_name"
                class="sv-checkout__shipping-attention-name"
                autocomplete="shipping name"
                :label="
                    $t({
                        defaultMessage: 'Contact person',
                        id: 'checkout.shipping_attention_name.label',
                        description:
                            'Label of the person at the company a shipped order is for the attention of',
                    })
                "
                :placeholder="
                    $t({
                        defaultMessage: 'Contact person',
                        id: 'checkout.shipping_attention_name.placeholder',
                        description:
                            'Placeholder of the person at the company a shipped order is for the attention of',
                    }) + getOptionalSuffix('shippingAttentionName')
                "
            />
            <div v-else class="sv-checkout__shipping-recipient grid grid-cols-2 gap-2">
                <HiddenLabelInput
                    v-model="fields.firstName"
                    name="shipping_first_name"
                    autocomplete="shipping given-name"
                    :label="
                        $t({
                            defaultMessage: 'First name',
                            id: 'checkout.shipping_first_name.label',
                            description:
                                'Label of the first name of the recipient of a shipped order',
                        })
                    "
                    :placeholder="
                        $t({
                            defaultMessage: 'First name',
                            id: 'checkout.shipping_first_name.placeholder',
                            description:
                                'Placeholder of the first name of the recipient of a shipped order',
                        }) + getOptionalSuffix('shippingFirstName')
                    "
                />
                <HiddenLabelInput
                    v-model="fields.lastName"
                    name="shipping_last_name"
                    autocomplete="shipping family-name"
                    :label="
                        $t({
                            defaultMessage: 'Last name',
                            id: 'checkout.shipping_last_name.label',
                            description:
                                'Label of the last name of the recipient of a shipped order',
                        })
                    "
                    :placeholder="
                        $t({
                            defaultMessage: 'Last name',
                            id: 'checkout.shipping_last_name.placeholder',
                            description:
                                'Placeholder of the last name of the recipient of a shipped order',
                        }) + getOptionalSuffix('shippingLastName')
                    "
                    :error="errors?.lastName"
                />
            </div>
        </template>
        <HiddenLabelInput
            v-if="shownParts.has('line1')"
            v-model="fields.addressLine1"
            :name="`${namePrefix}address_line_1`"
            :autocomplete="`${section} address-line1`"
            :label="labels.addressLine1Label"
            :placeholder="
                $t({
                    defaultMessage: 'Address line 1',
                    id: 'checkout.address.line1.placeholder',
                    description: 'Address line 1 of the customer address in the checkout form',
                }) + suffix('line1')
            "
            :error="errors?.addressLine1"
        />
        <HiddenLabelInput
            v-if="shownParts.has('line2')"
            v-model="fields.addressLine2"
            :name="`${namePrefix}address_line_2`"
            :autocomplete="`${section} address-line2`"
            :label="labels.addressLine2Label"
            :placeholder="
                $t({
                    defaultMessage: 'Address line 2',
                    id: 'checkout.address.line2.placeholder',
                    description: 'Address line 2 of the customer address in the checkout form',
                }) + suffix('line2')
            "
        />
        <div v-if="localityColumns" class="grid gap-2" :class="localityColumns">
            <HiddenLabelInput
                v-if="shownParts.has('postalCode')"
                v-model="fields.postalCode"
                :name="`${namePrefix}postal_code`"
                :autocomplete="`${section} postal-code`"
                :label="labels.postalCodeLabel"
                :placeholder="labels.postalCodePlaceholder + suffix('postalCode')"
                :error="localize(errors?.postalCode)"
            />
            <HiddenLabelInput
                v-if="shownParts.has('city')"
                v-model="fields.city"
                :name="`${namePrefix}city`"
                :autocomplete="`${section} address-level2`"
                :label="labels.cityLabel"
                :placeholder="labels.cityPlaceholder + suffix('city')"
                :error="errors?.city"
            />
            <HiddenLabelInput
                v-if="shownParts.has('state')"
                v-model="fields.state"
                :name="`${namePrefix}state`"
                :autocomplete="`${section} address-level1`"
                :label="labels.stateLabel"
                :placeholder="labels.statePlaceholder + suffix('state')"
                :error="errors?.state"
            />
        </div>
        <PhoneInput
            v-if="isShipping"
            v-model="phoneNumber"
            label-screen-reader-only
            required
            name="shipping_phone_number"
            class="sv-checkout__shipping-phone-number"
            :default-country="model[keys.country]"
            :label="
                $t({
                    defaultMessage: 'Phone number',
                    id: 'checkout.shipping_phone_number.label',
                    description:
                        'Label of the phone number the carrier can reach the recipient of a shipped order on',
                })
            "
            :placeholder="
                $t({
                    defaultMessage: 'Phone number',
                    id: 'checkout.shipping_phone_number.placeholder',
                    description:
                        'Placeholder of the phone number the carrier can reach the recipient of a shipped order on',
                })
            "
            :error="localize(errors?.phoneNumber)"
        />
    </div>
</template>
