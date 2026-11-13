import type { Amount, BillingPeriod, Invoice, InvoiceGroup } from '@solvimon/solvimon-types';
import { getComposedString, isEmpty } from '@solvimon/solvimon-ui';
import { splitInvoiceByRecurrence } from '@/utils/invoice';
import { sumAmounts } from '@/utils/amount';

const getAmountValue = (amount: Pick<Amount, 'quantity'>) => Number(amount.quantity);

/**
 * A one-off folded into a per-period figure is counted again for every period in the year: a €15
 * delivery, charged once either way, invents €165 of annual difference between monthly and yearly.
 *
 * `undefined` where part of the invoice fits neither side, so the badge goes without a number
 * rather than carrying one that cannot be relied on.
 */
export const getPeriodRecurringAmount = (invoice: Invoice | undefined): Amount | undefined => {
    const period = invoice?.periods?.[0];

    if (!invoice || !period) {
        return undefined;
    }

    // One period, not the whole invoice: a preview that prorates a part period and then bills a
    // full one would otherwise report the two added together as the price of one of them.
    const split = splitInvoiceByRecurrence({ ...invoice, periods: [period] });

    if (!split.hasOneOff) {
        return period.amount_including_tax;
    }

    return split.hasUnattributed ? undefined : split.recurring.includingTax;
};

export const getAnnualizedAmount = (period: BillingPeriod, amount?: Amount): Amount | undefined => {
    if (!amount) {
        return undefined;
    }

    const base = {
        DAY: 365,
        WEEK: 52,
        MONTH: 12,
        YEAR: 1,
    } as const;

    const multiplier = base[period.type] / Math.max(period.value ?? 1, 1);
    const annualValue = getAmountValue(amount) * multiplier;

    if (!Number.isFinite(annualValue)) {
        return undefined;
    }

    return { quantity: annualValue.toFixed(2), currency: amount.currency };
};

export const getSavingsAmount = (fromAmount?: Amount, toAmount?: Amount): Amount | undefined => {
    if (!fromAmount || !toAmount) {
        return undefined;
    }

    const delta = getAmountValue(fromAmount) - getAmountValue(toAmount);

    if (!Number.isFinite(delta) || delta <= 0) {
        return undefined;
    }

    return { quantity: delta.toFixed(2), currency: fromAmount.currency };
};

export const getInvoiceGroupName = (group: InvoiceGroup): string => {
    if (group.pricing?.name && !isEmpty(group.pricing.name)) {
        return group.pricing.name;
    }

    // Typed as returning a string, but a composition of nothing comes back undefined.
    return getComposedString(group.products?.map(({ name }) => name) ?? []) ?? '';
};

/** Excluding tax, the basis the rows beside it are shown on. */
export const getGroupsSubtotal = (groups: InvoiceGroup[], currency: string): Amount =>
    sumAmounts(
        groups.map(({ amount_excluding_tax }) => amount_excluding_tax),
        currency,
    );

/**
 * How many of a product the group charges: the meter values its lines bill, summed over tiers, or 1
 * for a fee without one. `undefined` for a discount, and for a group of several prices, whose sum
 * would mix seats with units.
 */
export const getInvoiceGroupQuantity = (group: InvoiceGroup): number | undefined => {
    const lines = (group.lines ?? []).filter(({ type }) => type === 'REVENUE');
    if (!lines.length || new Set(lines.map((line) => line.pricing_item_config_id)).size > 1) {
        return undefined;
    }

    const metered = lines.flatMap(({ details }) =>
        details?.meter_value?.number === undefined ? [] : [Number(details.meter_value.number)],
    );
    return metered.length ? metered.reduce((sum, number) => sum + number, 0) : 1;
};

const COMPACT_UNITS = [
    { size: 1e9, suffix: 'B' },
    { size: 1e6, suffix: 'M' },
    { size: 1e3, suffix: 'K' },
];

/**
 * A count of at most three digits, without decimals: from a thousand on it is cut down to whole
 * thousands (K), millions (M) or billions (B), with a + when anything was cut off, so 9,592,920 is
 * 9M+. `exact` is set only when `label` is not the whole number, for a tooltip.
 */
export const getCompactQuantity = (
    quantity: number,
    formatNumber: (value: number) => string,
): { label: string; exact?: string } => {
    const exact = formatNumber(quantity);
    const unit = COMPACT_UNITS.find(({ size }) => quantity >= size);
    if (!unit) return { label: exact };

    const whole = Math.floor(quantity / unit.size);
    const label = `${formatNumber(whole)}${unit.suffix}${whole * unit.size < quantity ? '+' : ''}`;
    return { label, exact };
};
