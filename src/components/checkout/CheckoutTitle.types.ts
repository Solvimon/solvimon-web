import type { Amount, BillingPeriod, CountryCode, TimePeriod } from '@solvimon/solvimon-types';

export interface CheckoutTitleProps {
    trialPeriod?: TimePeriod;
    subscriptionName: string;
    /** What the subscription invoice comes to, and the one amount stated when nothing on it is charged only once. */
    amount: Amount;
    /** What is charged now: the trial invoice where there is a trial, the first invoice otherwise. */
    dueTodayAmount: Amount;
    /**
     * What the subscription renews at, where that is not what is charged today — a plan that also
     * sells hardware, shipping or a swap. Left out where the invoice only subscribes, and where
     * the two could not be told apart, so the title never states a price that is a guess.
     */
    recurringAmount?: Amount;
    /**
     * Whether usage is billed each period. A plan priced on what the customer uses charges
     * nothing for it up front, so without this an invoice of hardware alone reads as a purchase.
     */
    hasUsageCharges?: boolean;
    billingPeriod: BillingPeriod;
    countryCode: CountryCode | undefined;
    trialStartDate?: Date;
    subscriptionStartDate: Date;
}
