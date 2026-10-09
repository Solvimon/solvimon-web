import type { Amount, Invoice, InvoiceGroup, InvoiceLine } from '@solvimon/solvimon-types';
import { sumAmounts } from './amount';

export const isInvoiceUsageBased = (invoice: Invoice) => {
    return (
        invoice.periods?.some((period) =>
            period.groups?.some((group) =>
                group.lines?.some((line) =>
                    line.product_items.some(
                        (productItem) => productItem.model_type === 'USAGE_BASED',
                    ),
                ),
            ),
        ) ?? false
    );
};

export type InvoiceRecurrence = 'RECURRING' | 'ONE_OFF' | 'UNATTRIBUTED';

export interface InvoiceAmountTotals {
    excludingTax: Amount;
    includingTax: Amount;
}

export interface InvoiceRecurrenceSplit {
    recurring: InvoiceAmountTotals;
    oneOff: InvoiceAmountTotals;
    /**
     * What fits neither side — an invoice-wide discount, a markup. A caller printing a recurring
     * price must read a non-zero amount here as "not trustworthy", never fold it into one of them.
     */
    unattributed: InvoiceAmountTotals;
    hasOneOff: boolean;
    hasUnattributed: boolean;
}

const RECURRENCE_BY_GROUP_TYPE: Record<InvoiceGroup['type'], InvoiceRecurrence> = {
    PRICING: 'RECURRING',
    REVENUE: 'RECURRING',
    COMMITMENT: 'RECURRING',
    ONE_OFF: 'ONE_OFF',
    DISCOUNT: 'UNATTRIBUTED',
    MARKUP: 'UNATTRIBUTED',
    DEDUCTION: 'UNATTRIBUTED',
};

// The product item's model type is the only thing that marks a one-off: the API types both the
// group and the line REVENUE. Everything but ONE_OFF comes back next period, usage and seats
// included.
const classifyLine = (line: InvoiceLine): InvoiceRecurrence | undefined => {
    if (line.type === 'ONE_OFF') {
        return 'ONE_OFF';
    }

    const modelTypes = line.product_items?.map(({ model_type }) => model_type) ?? [];

    if (!modelTypes.length) {
        return undefined;
    }

    return modelTypes.every((modelType) => modelType === 'ONE_OFF') ? 'ONE_OFF' : 'RECURRING';
};

/**
 * A group is taken whole, because a summary row carries the group's own amount: one whose lines
 * disagree would contradict whichever heading it went under, and lands in `other` with the
 * invoice-wide discounts, which belong under neither.
 */
export function getInvoiceGroupsByRecurrence(invoice: Invoice): {
    recurring: InvoiceGroup[];
    oneOff: InvoiceGroup[];
    other: InvoiceGroup[];
} {
    const buckets: Record<InvoiceRecurrence, InvoiceGroup[]> = {
        RECURRING: [],
        ONE_OFF: [],
        UNATTRIBUTED: [],
    };

    invoice.periods?.forEach((period) => {
        period.groups?.forEach((group) => {
            const groupRecurrence = RECURRENCE_BY_GROUP_TYPE[group.type] ?? 'UNATTRIBUTED';

            const recurrences = new Set(
                groupRecurrence === 'RECURRING' && group.lines?.length
                    ? group.lines.map((line) => classifyLine(line) ?? 'RECURRING')
                    : [groupRecurrence],
            );

            buckets[recurrences.size === 1 ? [...recurrences][0] : 'UNATTRIBUTED'].push(group);
        });
    });

    return {
        recurring: buckets.RECURRING,
        oneOff: buckets.ONE_OFF,
        other: buckets.UNATTRIBUTED,
    };
}

/**
 * Only ever an approximation of the next invoice: proration, a setup fee or an invoice-wide
 * discount all make "this invoice minus its one-off lines" something other than what it renews at.
 *
 * The group's own type stands in where a preview has not expanded its lines.
 */
export function splitInvoiceByRecurrence(invoice: Invoice): InvoiceRecurrenceSplit {
    const currency = invoice.billing_currency;
    const buckets: Record<InvoiceRecurrence, { excludingTax: Amount[]; includingTax: Amount[] }> = {
        RECURRING: { excludingTax: [], includingTax: [] },
        ONE_OFF: { excludingTax: [], includingTax: [] },
        UNATTRIBUTED: { excludingTax: [], includingTax: [] },
    };

    const add = (
        recurrence: InvoiceRecurrence,
        amounts: { amount_excluding_tax?: Amount; amount_including_tax?: Amount },
    ) => {
        const bucket = buckets[recurrence];
        if (amounts.amount_excluding_tax) {
            bucket.excludingTax.push(amounts.amount_excluding_tax);
        }
        if (amounts.amount_including_tax) {
            bucket.includingTax.push(amounts.amount_including_tax);
        }
    };

    invoice.periods?.forEach((period) => {
        period.groups?.forEach((group) => {
            const groupRecurrence = RECURRENCE_BY_GROUP_TYPE[group.type] ?? 'UNATTRIBUTED';

            if (!group.lines?.length) {
                add(groupRecurrence, group);
                return;
            }

            group.lines.forEach((line) =>
                add(
                    groupRecurrence === 'RECURRING'
                        ? (classifyLine(line) ?? groupRecurrence)
                        : groupRecurrence,
                    line,
                ),
            );
        });
    });

    const totals = (recurrence: InvoiceRecurrence): InvoiceAmountTotals => ({
        excludingTax: sumAmounts(buckets[recurrence].excludingTax, currency),
        includingTax: sumAmounts(buckets[recurrence].includingTax, currency),
    });

    const isZero = (totals: InvoiceAmountTotals) =>
        Number(totals.excludingTax.quantity) === 0 && Number(totals.includingTax.quantity) === 0;

    const oneOff = totals('ONE_OFF');
    const unattributed = totals('UNATTRIBUTED');

    return {
        recurring: totals('RECURRING'),
        oneOff,
        unattributed,
        hasOneOff: !isZero(oneOff),
        hasUnattributed: !isZero(unattributed),
    };
}
