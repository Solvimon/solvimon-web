import { mount } from '@vue/test-utils';
import { ErrorHandlingProvider, IntlProvider } from '@solvimon/solvimon-ui';
import type { Amount, BillingPeriod } from '@solvimon/solvimon-types';
import { h } from 'vue';
import CheckoutTitle from './CheckoutTitle.vue';
import type { CheckoutTitleProps } from './CheckoutTitle.types';

const { formatted } = vi.hoisted(() => ({
    formatted: { amount: '€10.00', period: 'month' },
}));

// Both values can come from the API: an amount carries its currency, and a period the formatter
// does not know falls back to its raw value.
vi.mock('@solvimon/solvimon-ui', async () => ({
    ...(await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui')),
    formatAmount: () => formatted.amount,
    formatBillingPeriod: () => formatted.period,
}));

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
