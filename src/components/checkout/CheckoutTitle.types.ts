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
    /** Whether the invoice charges anything that will not be charged again. */
    hasOneOffCharges?: boolean;
    /** Whether anything is charged again at all — a plan billed on usage renews at zero and does. */
    hasRecurringCharge?: boolean;
    hasUsageCharges?: boolean;
    billingPeriod: BillingPeriod;
    countryCode: CountryCode | undefined;
    trialStartDate?: Date;
    subscriptionStartDate: Date;
}
