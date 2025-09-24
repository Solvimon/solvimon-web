import type { CountryCode } from '@solvimon/types';

export interface CheckoutProps {
    /**
     * Optional two letter country code for the customer. When supplied, the correct
     * payment method options and tax will be shown.
     */
    countryCode?: CountryCode;
    /**
     * Optional email address of the customer. This will be pre-filled in the checkout form.
     */
    email?: string;
    /**
     * Optional enabled pricing ids.
     */
    enabledPricingIds?: string[];
    /**
     * Optional avatar.
     */
    avatar?: string;
}
