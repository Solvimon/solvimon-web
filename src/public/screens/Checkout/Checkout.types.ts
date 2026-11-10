import type { CountryCode } from '@solvimon/solvimon-types';

export interface CheckoutConfiguration {
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
     * Optional coupon/promotion code. This will be pre-filled and applied automatically.
     * When not provided, it falls back to a `coupon_code` query parameter on the page.
     */
    couponCode?: string;
    /**
     * Optional enabled pricing ids.
     */
    enabledPricingIds?: string[];
}

export interface CheckoutProps {
    configuration?: CheckoutConfiguration;
}
