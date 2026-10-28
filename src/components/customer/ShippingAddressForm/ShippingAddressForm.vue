<script setup lang="ts">
import { computed, ref } from 'vue';
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
    addressRules,
    shippingRecipientRules,
} from '@/components/customer/CheckoutForm/addressRules';
import { useAddressFormats } from '@/components/customer/CheckoutForm/useAddressFormats';
import HiddenLabelInput from '@/components/customer/HiddenLabelInput.vue';
import { asOptionalText, formControlModel } from '@/utils/formControl';
import { randomUuid } from '@/utils/randomUuid';
import { toAddress } from '@/utils/shippingAddress';
import type { CreateShippingAddressPayload, ShippingAddress } from '@/types/shippingAddress';

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

const fromCustomer = (): Partial<CheckoutFormState> => ({
    type: customer.type,
    email: customer.email,
    country: customerCountry,
    shippingCountry: customerCountry,
    // An organization is shipped to under its legal name; a person under their own.
    ...(isOrganization(customer) && { companyLegalName: customer.organization?.legal_name }),
    ...(isIndividual(customer) && {
        shippingFirstName: customer.individual?.name?.first_name,
        shippingLastName: customer.individual?.name?.last_name,
    }),
});

const fromAddress = ({
    recipient = {},
    ...stored
}: ShippingAddress): Partial<CheckoutFormState> => {
    const address = toAddress(stored.address);
    const country = isCountryCode(address.country) ? address.country : customerCountry;

    return {
        type: recipient.type ?? customer.type,
        email: recipient.email || customer.email,
        country,
        shippingCountry: country,
        companyLegalName: recipient.organization?.company_name,
        shippingAttentionName: recipient.organization?.attention_name ?? undefined,
        shippingFirstName: recipient.individual?.name?.first_name,
        shippingLastName: recipient.individual?.name?.last_name,
        shippingAddressLine1: address.line1,
        shippingAddressLine2: address.line2,
        shippingPostalCode: address.postal_code,
        shippingCity: address.city,
        shippingState: address.state,
        shippingPhoneNumber: recipient.phone_number || undefined,
    };
};

const form = ref<CheckoutFormState>(
    getInitialState({
        ...(props.address ? fromAddress(props.address) : fromCustomer()),
        billingAddressSameAsShipping: true,
    }),
);

const { formatOf } = useAddressFormats({
    isNeeded: () => true,
    countries: [() => form.value.shippingCountry],
});

const format = computed(() => formatOf(form.value.shippingCountry));

const isOrganizationRecipient = computed(() => form.value.type === 'ORGANIZATION');

/** An organization is shipped to under its name, which the customer may not have on file. */
const companyName = formControlModel(form, 'companyLegalName', asOptionalText);

const requiredFields = computed<(keyof CheckoutFormState)[]>(() => [
    ...getRequiredAddressFields('SHIPPING', form.value.shippingCountry, format.value),
    'shippingCountry',
    'shippingPhoneNumber',
    ...(isOrganizationRecipient.value ? [] : (['shippingLastName'] as const)),
]);

const isRequired = (field: keyof CheckoutFormState) => requiredFields.value.includes(field);

const validation = useValidation(
    computed(() => ({
        ...addressRules('SHIPPING', () => format.value, isRequired),
        ...shippingRecipientRules(isRequired),
        companyLegalName: { required: requiredIf(() => isOrganizationRecipient.value) },
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
     * the fields say what. Every address gets a fresh reference, since the API keeps it unique per
     * customer, and an edit is stored as a new address next to the one it replaces.
     */
    submit: async (): Promise<CreateShippingAddressPayload | undefined> => {
        if (!(await validation.value.$validate())) {
            return undefined;
        }

        return {
            ...toShippingAddressDetails(form.value, randomUuid(), format.value),
            customer_id: props.customer.id,
        };
    },
});
</script>

<template>
    <fieldset class="sv-shipping-address-form grid grid-cols-1 gap-2" :disabled="disabled">
        <HiddenLabelInput
            v-if="isOrganizationRecipient"
            v-model="companyName"
            name="shipping_company_name"
            class="sv-shipping-address-form__company-name"
            autocomplete="shipping organization"
            :label="
                $t({
                    defaultMessage: 'Company name',
                    id: 'shipping_address_form.company_name.label',
                    description: 'Label of the name of the company a shipping address is for',
                })
            "
            :placeholder="
                $t({
                    defaultMessage: 'Company name',
                    id: 'shipping_address_form.company_name.placeholder',
                    description: 'Placeholder of the name of the company a shipping address is for',
                })
            "
            :error="validation.companyLegalName.$errors"
        />
        <CheckoutAddressFields
            v-model="form"
            variant="SHIPPING"
            with-country
            country-before-address
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
