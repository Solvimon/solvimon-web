import type { Amount, BillingPeriod, CountryCode, TimePeriod } from '@solvimon/solvimon-types';

export interface CheckoutTitleProps {
    trialPeriod?: TimePeriod;
    subscriptionName: string;
    amount: Amount;
    billingPeriod: BillingPeriod;
    countryCode: CountryCode | undefined;
    trialStartDate?: Date;
    subscriptionStartDate: Date;
}
