import type { Amount, BillingPeriod, CountryCode, TimePeriod } from '@solvimon/solvimon-types';

export interface CheckoutTitleProps {
    trialPeriod?: TimePeriod;
    subscriptionName: string;
    /** What the subscription invoice comes to. */
    amount: Amount;
    /** What is charged now: the trial invoice where there is one, the first invoice otherwise. */
    dueTodayAmount: Amount;
    /** What it renews at, where that is not what is charged today. Absent where it cannot be told. */
    recurringAmount?: Amount;
    hasUsageCharges?: boolean;
    billingPeriod: BillingPeriod;
    countryCode: CountryCode | undefined;
    trialStartDate?: Date;
    subscriptionStartDate: Date;
}
