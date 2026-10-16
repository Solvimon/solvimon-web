<script setup lang="ts">
import { computed, reactive } from 'vue';
import { CountrySelect, Input, isValidCountryCode, useIntl } from '@solvimon/solvimon-ui';
import type { CountryCode } from '@solvimon/solvimon-types';
import type { CheckoutAddressFieldsProps } from './CheckoutAddressFields.types';
import type { CheckoutFormState } from './CheckoutForm.types';
import HiddenLabelInput from '@/components/customer/HiddenLabelInput.vue';
import { useCustomerFormLabels } from '@/components/customer/useCustomerFormLabels';
import { asOptionalText, formControlModel, type SelectControlValue } from '@/utils/formControl';

// `isValidCountryCode` answers with a plain boolean, so the narrowing is ours to state.
const isCountryCode = (value: string): value is CountryCode => isValidCountryCode(value);

/**
 * Which state each field reads, per address. An instance keeps the variant it was mounted with —
 * the two addresses are separate branches of the form — so the keys are resolved once.
 */
const FIELDS_BY_VARIANT = {
    BILLING: {
        addressLine1: 'addressLine1',
        addressLine2: 'addressLine2',
        postalCode: 'postalCode',
        city: 'city',
        state: 'state',
        country: 'country',
    },
    SHIPPING: {
        addressLine1: 'shippingAddressLine1',
        addressLine2: 'shippingAddressLine2',
        postalCode: 'shippingPostalCode',
        city: 'shippingCity',
        state: 'shippingState',
        country: 'shippingCountry',
    },
} as const satisfies Record<string, Record<string, keyof CheckoutFormState>>;

/** The name each input is submitted under, so a browser can fill the right address. */
const NAME_PREFIX_BY_VARIANT = { BILLING: '', SHIPPING: 'shipping_' } as const;

const props = defineProps<CheckoutAddressFieldsProps>();

const model = defineModel<CheckoutFormState>({ required: true });

const { $t } = useIntl();
const labels = useCustomerFormLabels();

const keys = FIELDS_BY_VARIANT[props.variant];
const namePrefix = NAME_PREFIX_BY_VARIANT[props.variant];

const fields = reactive({
    addressLine1: formControlModel(model, keys.addressLine1, asOptionalText),
    addressLine2: formControlModel(model, keys.addressLine2, asOptionalText),
    postalCode: formControlModel(model, keys.postalCode, asOptionalText),
    city: formControlModel(model, keys.city, asOptionalText),
    state: formControlModel(model, keys.state, asOptionalText),
    // Only a shipping address has a recipient for the carrier to call; a billing address has none.
    phoneNumber: formControlModel(model, 'shippingPhoneNumber', asOptionalText),
});

const country = computed<SelectControlValue>({
    get: () => model.value[keys.country],
    set: (value) => {
        const code = asOptionalText(value);
        model.value[keys.country] = code !== undefined && isCountryCode(code) ? code : undefined;
    },
});

const suffix = (field: 'addressLine1' | 'addressLine2' | 'postalCode' | 'city' | 'state') =>
    props.getOptionalSuffix(keys[field]);
</script>

<template>
    <div class="sv-checkout-address-fields flex flex-col gap-3">
        <Input
            v-model="fields.addressLine1"
            :name="`${namePrefix}address_line_1`"
            :label="label"
            :placeholder="
                $t({
                    defaultMessage: 'Address line 1...',
                    id: 'checkout.address.line1.placeholder',
                    description: 'Address line 1 of the customer address in the checkout form',
                }) + suffix('addressLine1')
            "
            required
            :error="errors?.addressLine1"
        />
        <HiddenLabelInput
            v-model="fields.addressLine2"
            :name="`${namePrefix}address_line_2`"
            :label="labels.addressLine2Label"
            :placeholder="
                $t({
                    defaultMessage: 'Address line 2...',
                    id: 'checkout.address.line2.placeholder',
                    description: 'Address line 2 of the customer address in the checkout form',
                }) + suffix('addressLine2')
            "
        />
        <div class="grid grid-cols-3 gap-2">
            <HiddenLabelInput
                v-model="fields.postalCode"
                :name="`${namePrefix}postal_code`"
                :label="labels.postalCodeLabel"
                :placeholder="labels.postalCodePlaceholder + suffix('postalCode')"
                :error="errors?.postalCode"
            />
            <HiddenLabelInput
                v-model="fields.city"
                :name="`${namePrefix}city`"
                :label="labels.cityLabel"
                :placeholder="labels.cityPlaceholder + suffix('city')"
                :error="errors?.city"
            />
            <HiddenLabelInput
                v-model="fields.state"
                :name="`${namePrefix}state`"
                :label="labels.stateLabel"
                :placeholder="labels.statePlaceholder + suffix('state')"
                :error="errors?.state"
            />
        </div>
        <CountrySelect
            v-if="withCountry"
            v-model:single-model-value="country"
            required
            :label="countryLabel ?? labels.countryLabel"
            :name="`${namePrefix}country`"
            :error="errors?.country"
        />
        <Input
            v-if="variant === 'SHIPPING'"
            v-model="fields.phoneNumber"
            required
            name="shipping_phone_number"
            class="sv-checkout__shipping-phone-number"
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
                    defaultMessage: 'Phone number...',
                    id: 'checkout.shipping_phone_number.placeholder',
                    description:
                        'Placeholder of the phone number of the recipient of a shipped order',
                }) + getOptionalSuffix('shippingPhoneNumber')
            "
            :error="errors?.phoneNumber"
        />
    </div>
</template>
