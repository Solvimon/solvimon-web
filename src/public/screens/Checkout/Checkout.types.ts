import type { CountryCode } from '@solvimon/solvimon-types';

export interface CheckoutConfiguration {
    /**
     * The customer's two-letter country, which the form starts with. It decides the tax and the
     * payment methods on offer. Defaults to none: the customer picks one.
     */
    countryCode?: CountryCode;
    /** The customer's email address, which the form starts with. */
    email?: string;
    /**
     * A promotion code to apply once the subscription has loaded. Defaults to the page's
     * `coupon_code` query parameter, if it has one.
     */
    couponCode?: string;
    /**
     * Pricings that start switched on, such as add-ons the host preselects. A group that needs a
     * pricing and has none of these gets its first.
     */
    enabledPricingIds?: string[];
}

export interface CheckoutProps {
    configuration?: CheckoutConfiguration;
}
