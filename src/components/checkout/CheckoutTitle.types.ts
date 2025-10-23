import type { Amount, BillingPeriod, TimePeriod } from '@solvimon/types';

export interface CheckoutTitleProps {
    trialPeriod?: TimePeriod;
    subscriptionName: string;
    amount: Amount;
    billingPeriod: BillingPeriod;
}
