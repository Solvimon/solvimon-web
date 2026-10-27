import { requiredIf } from '@vuelidate/validators';
import type { CheckoutFormState } from './CheckoutForm.types';
import { ADDRESS_KEYS, type AddressVariant } from './CheckoutForm.lib';
import { isPhoneNumberPlausible, isPostalCodeValid, type AddressFormat } from './addressFormat';

// Shared by every form that asks for an address, so the same address passes or fails everywhere.
type IsRequired = (field: keyof CheckoutFormState) => boolean;

export const requiredWhenAsked = (isRequired: IsRequired, field: keyof CheckoutFormState) => ({
    required: requiredIf(() => isRequired(field)),
});

const isPostalCodeValidFor =
    (format: () => AddressFormat | undefined) =>
    (value: unknown): boolean => {
        const addressFormat = format();
        return (
            typeof value !== 'string' ||
            !value.trim() ||
            !addressFormat ||
            isPostalCodeValid(addressFormat, value)
        );
    };

export const addressRules = (
    variant: AddressVariant,
    format: () => AddressFormat | undefined,
    isRequired: IsRequired,
) => {
    const keys = ADDRESS_KEYS[variant];
    return {
        [keys.line1]: requiredWhenAsked(isRequired, keys.line1),
        [keys.city]: requiredWhenAsked(isRequired, keys.city),
        [keys.state]: requiredWhenAsked(isRequired, keys.state),
        [keys.country]: requiredWhenAsked(isRequired, keys.country),
        [keys.postalCode]: {
            ...requiredWhenAsked(isRequired, keys.postalCode),
            postalCodeFormat: {
                $validator: isPostalCodeValidFor(format),
                $message: 'The postal code does not match the country',
            },
        },
    };
};

/** Who a shipped order is for and how the carrier reaches them. */
export const shippingRecipientRules = (isRequired: IsRequired) => ({
    shippingPhoneNumber: {
        ...requiredWhenAsked(isRequired, 'shippingPhoneNumber'),
        phoneNumberFormat: {
            $validator: (value: unknown) =>
                typeof value !== 'string' || !value.trim() || isPhoneNumberPlausible(value),
            $message: 'The phone number is not valid',
        },
    },
    shippingLastName: requiredWhenAsked(isRequired, 'shippingLastName'),
});
