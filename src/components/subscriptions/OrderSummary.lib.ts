import type { Amount, BillingPeriod, Invoice, InvoiceGroup } from '@solvimon/solvimon-types';
import { getComposedString, isEmpty } from '@solvimon/solvimon-ui';
import { splitInvoiceByRecurrence } from '@/utils/invoice';
import { sumAmounts } from '@/utils/amount';

const getAmountValue = (amount: Pick<Amount, 'quantity'>) => Number(amount.quantity);

/**
 * What a billing period costs every time it comes round, with anything charged only once left out.
 *
 * The price beside an option and the saving between two of them are both per-period figures, and a
 * one-off folded into them is counted again for every period in the year: a €15 delivery, charged
 * once either way, turns into €165 of invented annual difference between monthly and yearly.
 *
 * `undefined` where part of the invoice fits neither side, so the option goes without a price and
 * the badge without a number rather than carrying one that cannot be relied on.
 */
export const getPeriodRecurringAmount = (invoice: Invoice | undefined): Amount | undefined => {
    if (!invoice) {
        return undefined;
    }

    const split = splitInvoiceByRecurrence(invoice);

    if (!split.hasOneOff) {
        return invoice.periods?.[0]?.amount_including_tax;
    }

    return split.hasUnattributed ? undefined : split.recurring.includingTax;
};

/** A period amount as its yearly equivalent, on fixed day, week and month counts. */
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

/** What the cheaper of two yearly equivalents saves, or nothing where it saves nothing. */
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

/** A group named the way the summary has always named one: by its pricing, else by its products. */
export const getInvoiceGroupName = (group: InvoiceGroup): string => {
    if (group.pricing?.name && !isEmpty(group.pricing.name)) {
        return group.pricing.name;
    }

    // Typed as returning a string, but a composition of nothing comes back undefined.
    return getComposedString(group.products?.map(({ name }) => name) ?? []) ?? '';
};

/** What a run of groups comes to, excluding tax — the same basis the rows beside it are shown on. */
export const getGroupsSubtotal = (groups: InvoiceGroup[], currency: string): Amount =>
    sumAmounts(
        groups.map(({ amount_excluding_tax }) => amount_excluding_tax),
        currency,
    );
