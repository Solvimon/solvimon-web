import type { CountryCode } from '@solvimon/solvimon-types';
import type { Error } from '@/types/errors';

export interface CheckoutConfiguration {
    /**
     * The avatar for the checkout.
     */
    avatar?: string;
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
}

export interface CheckoutProps {
    configuration?: CheckoutConfiguration;
}

export interface CheckoutEmits {
    /**
     * Emitted when an error occurs.
     */
    (e: 'error', error: Error): void;
    /**
     * Emitted when the checkout is ready.
     */
    (e: 'ready'): void;
}
