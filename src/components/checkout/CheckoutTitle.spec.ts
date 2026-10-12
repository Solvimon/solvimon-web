import { mount } from '@vue/test-utils';
import { formatAmount, formatBillingPeriod } from '@solvimon/solvimon-ui';
import type { Amount, BillingPeriod } from '@solvimon/solvimon-types';
import CheckoutTitle from './CheckoutTitle.vue';
import type { CheckoutTitleProps } from './CheckoutTitle.types';

const MONTHLY = { type: 'MONTH', value: 1 } as BillingPeriod;
const DUE_TODAY: Amount = { quantity: '35.00', currency: 'EUR' };
const RECURRING: Amount = { quantity: '10.00', currency: 'EUR' };

const month = formatBillingPeriod(MONTHLY, { short: true, hideValueForExactPeriods: true });

const mountTitle = (props: Partial<CheckoutTitleProps>) =>
    mount(CheckoutTitle, {
        props: {
            subscriptionName: 'Pro plan',
            amount: RECURRING,
            dueTodayAmount: DUE_TODAY,
            billingPeriod: MONTHLY,
            countryCode: 'NL',
            subscriptionStartDate: new Date('2026-10-09T00:00:00Z'),
            ...props,
        },
    });

/** The amounts the description sets in bold, in order. */
const boldAmounts = (wrapper: ReturnType<typeof mountTitle>) =>
    wrapper.findAll('strong').map((strong) => strong.text());

describe('CheckoutTitle', () => {
    it('states only what is due today for an order that does not renew', () => {
        const wrapper = mountTitle({ hasOneOffCharges: true });

        expect(wrapper.text()).toContain(`You will be billed ${formatAmount(DUE_TODAY)} today.`);
        expect(boldAmounts(wrapper)).toEqual([formatAmount(DUE_TODAY)]);
    });

    it('states what is due today and then what it renews at', () => {
        const wrapper = mountTitle({
            hasOneOffCharges: true,
            hasRecurringCharge: true,
            recurringAmount: RECURRING,
        });

        expect(wrapper.text()).toContain(
            `You will be billed ${formatAmount(DUE_TODAY)} today, then ${formatAmount(RECURRING)} per ${month}.`,
        );
        expect(boldAmounts(wrapper)).toEqual([formatAmount(DUE_TODAY), formatAmount(RECURRING)]);
    });

    it('states what is due today and that usage follows, for a plan billed on usage', () => {
        const wrapper = mountTitle({
            hasOneOffCharges: true,
            hasRecurringCharge: true,
            hasUsageCharges: true,
            recurringAmount: { quantity: '0.00', currency: 'EUR' },
        });

        expect(wrapper.text()).toContain(
            `You will be billed ${formatAmount(DUE_TODAY)} today. Usage is billed every ${month}.`,
        );
        expect(boldAmounts(wrapper)).toEqual([formatAmount(DUE_TODAY)]);
    });

    it('states only what is due today for an order that renews at nothing', () => {
        const wrapper = mountTitle({
            hasOneOffCharges: true,
            hasRecurringCharge: false,
            recurringAmount: { quantity: '0.00', currency: 'EUR' },
        });

        expect(wrapper.text()).toContain(`You will be billed ${formatAmount(DUE_TODAY)} today.`);
        expect(wrapper.text()).not.toContain('per');
    });

    describe('with a trial', () => {
        const START = new Date('2026-10-09T12:00:00Z');
        const startDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(START);

        it('states the price per period and the day it starts', () => {
            const wrapper = mountTitle({
                trialStartDate: new Date('2026-09-25T12:00:00Z'),
                subscriptionStartDate: START,
            });

            expect(wrapper.text()).toContain(
                `You will be billed ${formatAmount(RECURRING)} per ${month}, starting ${startDate}.`,
            );
            expect(boldAmounts(wrapper)).toEqual([formatAmount(RECURRING)]);
        });

        it('states what is due today, then the price per period and the day it starts', () => {
            const wrapper = mountTitle({
                hasOneOffCharges: true,
                hasRecurringCharge: true,
                recurringAmount: RECURRING,
                trialStartDate: new Date('2026-09-25T12:00:00Z'),
                subscriptionStartDate: START,
            });

            expect(wrapper.text()).toContain(
                `You will be billed ${formatAmount(DUE_TODAY)} today, then ${formatAmount(RECURRING)} per ${month}, starting ${startDate}.`,
            );
            expect(boldAmounts(wrapper)).toEqual([
                formatAmount(DUE_TODAY),
                formatAmount(RECURRING),
            ]);
        });
    });

    it('states the price per period for a subscription without one-off charges', () => {
        const wrapper = mountTitle({});

        expect(wrapper.text()).toContain(
            `You will be billed ${formatAmount(RECURRING)} per ${month}, starting today.`,
        );
        expect(boldAmounts(wrapper)).toEqual([formatAmount(RECURRING)]);
    });
});
