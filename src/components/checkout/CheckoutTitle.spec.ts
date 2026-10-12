import { mount } from '@vue/test-utils';
import {
    ErrorHandlingProvider,
    IntlProvider,
    formatAmount,
    formatBillingPeriod,
} from '@solvimon/solvimon-ui';
import type { Amount, BillingPeriod } from '@solvimon/solvimon-types';
import { h } from 'vue';
import CheckoutTitle from './CheckoutTitle.vue';
import type { CheckoutTitleProps } from './CheckoutTitle.types';

const { formatted } = vi.hoisted(() => ({
    formatted: {} as { amount?: string; period?: string },
}));

// Both values can come from the API: an amount carries its currency, and a period the formatter
// does not know falls back to its raw value. Left unset, the real formatters run.
vi.mock('@solvimon/solvimon-ui', async () => {
    const actual =
        await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    return {
        ...actual,
        formatAmount: (...args: Parameters<typeof actual.formatAmount>) =>
            formatted.amount ?? actual.formatAmount(...args),
        formatBillingPeriod: (...args: Parameters<typeof actual.formatBillingPeriod>) =>
            formatted.period ?? actual.formatBillingPeriod(...args),
    };
});

const HOSTILE = '<img src=x onerror="window.__pwned=1">';

const amount = { quantity: '10', currency: 'EUR' } as Amount;

const baseProps: CheckoutTitleProps = {
    subscriptionName: 'Pro',
    amount,
    dueTodayAmount: amount,
    billingPeriod: { unit: 'MONTH', value: 1 } as unknown as BillingPeriod,
    countryCode: 'NL',
    subscriptionStartDate: new Date('2026-01-01'),
};

const mountTitle = (props: Partial<CheckoutTitleProps> = {}) =>
    mount({
        render: () =>
            h(ErrorHandlingProvider, null, () =>
                h(IntlProvider, { locale: 'en-US' }, () =>
                    h(CheckoutTitle, { ...baseProps, ...props }),
                ),
            ),
    });

describe('CheckoutTitle', () => {
    beforeEach(() => {
        formatted.amount = '€10.00';
        formatted.period = 'month';
    });

    afterEach(() => {
        formatted.amount = undefined;
        formatted.period = undefined;
    });

    it('states the price in bold', () => {
        const wrapper = mountTitle();

        expect(wrapper.text()).toContain('You will be billed €10.00 per month, starting today.');
        expect(wrapper.findAll('strong').map((node) => node.text())).toEqual(['€10.00']);
    });

    it('bolds both amounts where today differs from what it renews at', () => {
        const wrapper = mountTitle({
            dueTodayAmount: { quantity: '25', currency: 'EUR' } as Amount,
            recurringAmount: amount,
            hasRecurringCharge: true,
        });

        expect(wrapper.findAll('strong')).toHaveLength(2);
    });

    it.each([
        ['an amount', { amount: HOSTILE }],
        ['a period', { period: HOSTILE }],
        ['a script', { amount: '<script>window.__pwned=1</script>' }],
        ['a closing tag', { period: '</strong><img src=x>' }],
    ])('shows %s carrying markup as text', (_, values) => {
        Object.assign(formatted, values);
        const wrapper = mountTitle();

        expect(wrapper.find('img').exists()).toBe(false);
        expect(wrapper.find('script').exists()).toBe(false);
        expect(wrapper.text()).toContain(Object.values(values)[0]);
    });

    it('shows a period carrying markup as text while the price is unknown', () => {
        formatted.period = HOSTILE;
        const wrapper = mountTitle({ countryCode: undefined });

        expect(wrapper.find('img').exists()).toBe(false);
        expect(wrapper.text()).toContain(`per ${HOSTILE}, starting today`);
    });

    it('keeps a very long unicode value whole', () => {
        formatted.period = 'månad ✓ '.repeat(500);
        const wrapper = mountTitle();

        expect(wrapper.text()).toContain(formatted.period.trim());
    });
});

const MONTHLY = { type: 'MONTH', value: 1 } as BillingPeriod;
const DUE_TODAY: Amount = { quantity: '35.00', currency: 'EUR' };
const RECURRING: Amount = { quantity: '10.00', currency: 'EUR' };

const month = formatBillingPeriod(MONTHLY, { short: true, hideValueForExactPeriods: true });

const mountPricedTitle = (props: Partial<CheckoutTitleProps>) =>
    mountTitle({
        subscriptionName: 'Pro plan',
        amount: RECURRING,
        dueTodayAmount: DUE_TODAY,
        billingPeriod: MONTHLY,
        countryCode: 'NL',
        subscriptionStartDate: new Date('2026-10-09T00:00:00Z'),
        ...props,
    });

/** The amounts the description sets in bold, in order. */
const boldAmounts = (wrapper: ReturnType<typeof mountPricedTitle>) =>
    wrapper.findAll('strong').map((strong) => strong.text());

describe('CheckoutTitle description', () => {
    it('states only what is due today for an order that does not renew', () => {
        const wrapper = mountPricedTitle({ hasOneOffCharges: true });

        expect(wrapper.text()).toContain(`You will be billed ${formatAmount(DUE_TODAY)} today.`);
        expect(boldAmounts(wrapper)).toEqual([formatAmount(DUE_TODAY)]);
    });

    it('states what is due today and then what it renews at', () => {
        const wrapper = mountPricedTitle({
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
        const wrapper = mountPricedTitle({
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
        const wrapper = mountPricedTitle({
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
            const wrapper = mountPricedTitle({
                trialStartDate: new Date('2026-09-25T12:00:00Z'),
                subscriptionStartDate: START,
            });

            expect(wrapper.text()).toContain(
                `You will be billed ${formatAmount(RECURRING)} per ${month}, starting ${startDate}.`,
            );
            expect(boldAmounts(wrapper)).toEqual([formatAmount(RECURRING)]);
        });

        it('states what is due today, then the price per period and the day it starts', () => {
            const wrapper = mountPricedTitle({
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
        const wrapper = mountPricedTitle({});

        expect(wrapper.text()).toContain(
            `You will be billed ${formatAmount(RECURRING)} per ${month}, starting today.`,
        );
        expect(boldAmounts(wrapper)).toEqual([formatAmount(RECURRING)]);
    });
});
