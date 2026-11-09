import type { CountryCode } from '@solvimon/solvimon-types';
import type { SdkError } from '@/types/errors';

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
    /**
     * Optional callback function that is executed after a successful payment.
     * This can be used to execute follow up functionality and/or doing a redirect.
     * If you implement this callback, you are also responsible to manage a redirect
     * yourself. This overrides the redirect url configured in Solvimon Desk.
     */
    onPaymentSuccess?: () => void;
}

export interface CheckoutProps {
    configuration?: CheckoutConfiguration;
}

/** What the entry hands the checkout screen on top of the host's configuration. */
export interface CheckoutViewProps extends CheckoutProps {
    /** The branding emblem, shown in the order summary. */
    avatar?: string;
}

export interface CheckoutEmits {
    /**
     * Emitted when an error occurs.
     */
    (e: 'error', error: SdkError): void;
    /**
     * Emitted when the checkout is ready.
     */
    (e: 'ready'): void;
}
