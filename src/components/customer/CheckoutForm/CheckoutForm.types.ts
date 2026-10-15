import type { ConfiguredMeterValue, CountryCode, Pricing } from '@solvimon/solvimon-types';
import type { useCheckoutForm } from './useCheckoutForm';
import type { ShippingField } from './CheckoutForm.lib';

export interface CheckoutFormProps {
    validation: ReturnType<typeof useCheckoutForm>['validation'];
    initialState?: Partial<CheckoutFormState>;
    readOnlyEmail?: string;
    showCustomerInfoOnTop?: boolean;
    isBillingInformationMandatory?: boolean;
    /**
     * Whether the order is shipped, which the portal decides. The form then asks for a shipping
     * address first and offers to bill to the same one; left off, it asks only for billing details
     * exactly as it always has.
     */
    isShippingAddressRequired?: boolean;
    getIsFieldRequired: (field: keyof CheckoutFormState) => boolean;
    /** The same, for the shipping address, which the destination country answers for. */
    getIsShippingFieldRequired?: (field: ShippingField) => boolean;
    readOnly?: boolean;
}

export interface CheckoutFormEmits {
    (e: 'submit', state: CheckoutFormState): void;
}

export interface CheckoutFormState {
    email: string | undefined;
    /** The billing country. Where the order ships, `shippingCountry` is the one goods go to. */
    country: CountryCode | undefined;
    type: 'INDIVIDUAL' | 'ORGANIZATION';
    companyLegalName: string | undefined;
    firstName: string | undefined;
    infix: string | undefined;
    lastName: string | undefined;
    addressLine1: string | undefined;
    addressLine2: string | undefined;
    postalCode: string | undefined;
    city: string | undefined;
    state: string | undefined;
    companyVatNumber: string | undefined;
    /**
     * Where the order ships to. Only asked for when the portal says the order is shipped, and kept
     * apart from the billing address above, which is what the customer is invoiced against.
     */
    shippingAddressLine1: string | undefined;
    shippingAddressLine2: string | undefined;
    shippingPostalCode: string | undefined;
    shippingCity: string | undefined;
    shippingState: string | undefined;
    shippingCountry: CountryCode | undefined;
    /** How the carrier reaches the recipient; the API requires one on every shipping address. */
    shippingPhoneNumber: string | undefined;
    /**
     * Whether the invoice goes to the shipping address. While it does, the billing fields follow
     * the shipping ones, so everything downstream reads the billing address as it always has.
     */
    billingAddressSameAsShipping: boolean;
    seatsValues: ConfiguredMeterValue[] | undefined;
    unitsValues: ConfiguredMeterValue[] | undefined;
    promotionCode?: string;
    enabledPricingIds: Pricing['id'][] | undefined;
}
