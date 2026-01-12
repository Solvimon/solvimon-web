import type { CoreConfiguration } from '@adyen/adyen-web';
import type {
    Address,
    Amount,
    BillingPeriod,
    PaymentMethodOptionResponseEntry,
} from '@solvimon/types';

export interface ExpressPaymentMethodProps {
    amount: Amount;
    countryCode: string;
    locale: CoreConfiguration['locale'];
    isVisible: boolean;
    paymentMethodOptionsResponse: PaymentMethodOptionResponseEntry;
    billingInformation: {
        /**
         * The name of the subscription
         * Example: 'UD Pro subscription'
         */
        description: string;
        /**
         * The billing agreement
         * Example: 'Free for 3 days, then €22.99/month until canceled.'
         */
        agreement: string;
        /**
         * The management URL
         * Example: 'https://example.com/account/billing'
         */
        managementURL: string;
        /**
         * The trial period
         */
        trial?: {
            /**
             * The label of the trial period
             * Example: '3-day free trial'
             */
            label: string;
            /**
             * The amount of the trial period
             */
            amount: Amount;
            /**
             * The start date of the trial period
             */
            startDate: Date;
            /**
             * The end date of the trial period
             */
            endDate: Date;
        };
        /**
         * The regular period
         */
        regular: {
            /**
             * The label of the regular period
             * Example: 'UD Pro monthly'
             */
            label: string;
            /**
             * The amount of the regular period
             */
            amount: Amount;
            /**
             * The start date of the regular period
             */
            startDate: Date;
            /**
             * The interval of the regular period
             */
            interval: BillingPeriod;
        };
    };
}

export interface ExpressPaymentMethodEmits {
    (e: 'ready'): void;
    (e: 'update-billing-information', billingInformation: Partial<Address>): void;
}
