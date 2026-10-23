<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import {
    getCustomerCountry,
    isIndividual,
    isOrganization,
    isValidCountryCode,
    useIntl,
    useValidation,
} from '@solvimon/solvimon-ui';
import { requiredIf } from '@vuelidate/validators';
import type { CountryCode } from '@solvimon/solvimon-types';
import type { ShippingAddressFormProps } from './ShippingAddressForm.types';
import CheckoutAddressFields from '@/components/customer/CheckoutForm/CheckoutAddressFields.vue';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { getInitialState } from '@/components/customer/CheckoutForm/useCheckoutForm';
import {
    getRequiredAddressFields,
    toShippingAddressDetails,
} from '@/components/customer/CheckoutForm/CheckoutForm.lib';
import {
    getAddressFormat,
    isPhoneNumberPlausible,
    isPostalCodeValid,
    loadAddressFormats,
    type AddressFormatTable,
} from '@/components/customer/CheckoutForm/addressFormat';
import type { CreateShippingAddressPayload } from '@/types/shippingAddress';

const props = defineProps<ShippingAddressFormProps>();

const { $t } = useIntl();

/**
 * The checkout form's state, since its address fields are reused as they are. Only the shipping
 * part is filled in by the customer; the rest describes them for the recipient.
 */
const customer = props.customer;

// `isValidCountryCode` answers with a plain boolean, so the narrowing is ours to state.
const isCountryCode = (value: string): value is CountryCode => isValidCountryCode(value);

/** Where the customer is, which is where most of them ship to. */
const customerCountry = ((country) => (country && isCountryCode(country) ? country : undefined))(
    getCustomerCountry(customer),
);

const form = ref<CheckoutFormState>(
    getInitialState({
        type: customer.type,
        email: customer.email,
        country: customerCountry,
        shippingCountry: customerCountry,
        billingAddressSameAsShipping: true,
        // An organization is shipped to under its legal name; a person under their own.
        ...(isOrganization(customer) && { companyLegalName: customer.organization?.legal_name }),
        ...(isIndividual(customer) && {
            shippingFirstName: customer.individual?.name?.first_name,
            shippingLastName: customer.individual?.name?.last_name,
        }),
    }),
);

const addressFormats = shallowRef<AddressFormatTable>();

/**
 * The per-country formats are a chunk of their own. One that does not download leaves the fields
 * asking only for what every country needs, rather than the form not opening at all.
 */
onMounted(async () => {
    try {
        addressFormats.value = await loadAddressFormats();
    } catch {
        addressFormats.value = undefined;
    }
});

const format = computed(() =>
    addressFormats.value
        ? getAddressFormat(addressFormats.value, form.value.shippingCountry)
        : undefined,
);

const requiredFields = computed<(keyof CheckoutFormState)[]>(() => [
    ...getRequiredAddressFields('SHIPPING', form.value.shippingCountry, format.value),
    'shippingCountry',
    'shippingPhoneNumber',
    ...(form.value.type === 'ORGANIZATION' ? [] : (['shippingLastName'] as const)),
]);

const isRequired = (field: keyof CheckoutFormState) => requiredFields.value.includes(field);

const requiredWhenAsked = (field: keyof CheckoutFormState) => ({
    required: requiredIf(() => isRequired(field)),
});

const validation = useValidation(
    computed(() => ({
        shippingAddressLine1: requiredWhenAsked('shippingAddressLine1'),
        shippingCity: requiredWhenAsked('shippingCity'),
        shippingState: requiredWhenAsked('shippingState'),
        shippingCountry: requiredWhenAsked('shippingCountry'),
        shippingPostalCode: {
            ...requiredWhenAsked('shippingPostalCode'),
            postalCodeFormat: {
                $validator: (value: unknown) =>
                    typeof value !== 'string' ||
                    !value.trim() ||
                    !format.value ||
                    isPostalCodeValid(format.value, value),
                $message: 'The postal code does not match the country',
            },
        },
        shippingPhoneNumber: {
            ...requiredWhenAsked('shippingPhoneNumber'),
            phoneNumberFormat: {
                $validator: (value: unknown) =>
                    typeof value !== 'string' || !value.trim() || isPhoneNumberPlausible(value),
                $message: 'The phone number is not valid',
            },
        },
        shippingLastName: requiredWhenAsked('shippingLastName'),
    })),
    form,
);

const getOptionalSuffix = (field: keyof CheckoutFormState): string =>
    isRequired(field)
        ? ''
        : ' ' +
          $t({
              defaultMessage: '(optional)',
              id: 'checkout.optional_suffix.label',
              description: 'The suffix for optional fields in the checkout form',
          });

defineExpose({
    /**
     * Checks the form and hands back the address to store, or nothing while something is missing —
     * the fields say what. A fresh reference per address, since the API keeps it unique per customer.
     */
    submit: async (): Promise<CreateShippingAddressPayload | undefined> => {
        if (!(await validation.value.$validate())) {
            return undefined;
        }

        return {
            ...toShippingAddressDetails(form.value, crypto.randomUUID(), format.value),
            customer_id: props.customer.id,
        };
    },
});
</script>

<template>
    <fieldset class="sv-shipping-address-form grid grid-cols-1 gap-2" :disabled="disabled">
        <CheckoutAddressFields
            v-model="form"
            variant="SHIPPING"
            with-country
            :country-label="
                $t({
                    defaultMessage: 'Country',
                    id: 'shipping_address_form.country.label',
                    description: 'Label of the country of a shipping address',
                })
            "
            :get-optional-suffix="getOptionalSuffix"
            :format="format"
            :errors="{
                addressLine1: validation.shippingAddressLine1.$errors,
                postalCode: validation.shippingPostalCode.$errors,
                city: validation.shippingCity.$errors,
                state: validation.shippingState.$errors,
                country: validation.shippingCountry.$errors,
                phoneNumber: validation.shippingPhoneNumber.$errors,
                lastName: validation.shippingLastName.$errors,
            }"
        />
    </fieldset>
</template>
