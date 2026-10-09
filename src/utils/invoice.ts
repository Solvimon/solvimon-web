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

/** Which part of the agreement a charge belongs to: the one that repeats, or the one that does not. */
export type InvoiceRecurrence = 'RECURRING' | 'ONE_OFF' | 'UNATTRIBUTED';

export interface InvoiceAmountTotals {
    excludingTax: Amount;
    includingTax: Amount;
}

export interface InvoiceRecurrenceSplit {
    recurring: InvoiceAmountTotals;
    oneOff: InvoiceAmountTotals;
    /**
     * What could not be put on either side — an invoice-wide discount, a markup, a group whose
     * lines name no product items. A caller that prints a recurring price must treat a non-zero
     * amount here as "the split is not trustworthy" rather than fold it into one of the two.
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

/**
 * Every model type but `ONE_OFF` is charged again next period: usage and seats vary in size, but
 * they come back. `CREDITS` is read as recurring too — a grant that is genuinely a single top-up
 * is modelled as a one-off item and classified by `ONE_OFF` above.
 */
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
 * The invoice's groups split into the ones charged every period and the ones charged once, for a
 * summary that lists them under headings of their own.
 *
 * A group is taken as a whole: it stands for one pricing, and a summary row carries the group's
 * own amount, so a group whose lines disagree cannot be put on one side without the row beneath
 * the heading contradicting it. Those stay with the recurring ones, which is where every group was
 * listed before any of this.
 */
export function getInvoiceGroupsByRecurrence(invoice: Invoice): {
    recurring: InvoiceGroup[];
    oneOff: InvoiceGroup[];
} {
    const recurring: InvoiceGroup[] = [];
    const oneOff: InvoiceGroup[] = [];

    invoice.periods?.forEach((period) => {
        period.groups?.forEach((group) => {
            const recurrences = new Set(
                group.lines?.length
                    ? group.lines.map((line) => classifyLine(line) ?? 'RECURRING')
                    : [RECURRENCE_BY_GROUP_TYPE[group.type] ?? 'RECURRING'],
            );

            (recurrences.size === 1 && recurrences.has('ONE_OFF') ? oneOff : recurring).push(group);
        });
    });

    return { recurring, oneOff };
}

/**
 * What the invoice charges once and what it charges every period, told apart.
 *
 * Only ever an approximation of the next invoice: a first period that is prorated, a setup fee or
 * an invoice-wide discount all make "this invoice minus its one-off lines" something other than
 * what the subscription renews at. Where the API returns the recurring invoice itself, prefer it —
 * this is for the case where it does not.
 *
 * Lines are classified where a group has them and the group's own type stands in where it does
 * not, since a preview is not guaranteed to expand its lines.
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

            group.lines.forEach((line) => {
                // A group the API already calls one-off settles its lines; anything else is read
                // from the line, which knows what it charges for better than the group does.
                add(
                    groupRecurrence === 'ONE_OFF'
                        ? 'ONE_OFF'
                        : (classifyLine(line) ?? groupRecurrence),
                    line,
                );
            });
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
