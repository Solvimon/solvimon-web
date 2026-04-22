import type { Invoice, InvoiceCreditQuantity, InvoicePeriod } from '@solvimon/types';

export type InvoiceCreditsBreakdownRow = {
    id: string;
    label: string;
    amount: string;
    rows: Array<{
        id: string;
        label: string;
        used: string;
        left: string;
        available: string;
    }>;
};

export type InvoiceCreditsBreakdownPeriod = {
    id: string;
    title: string;
    rows: InvoiceCreditsBreakdownRow[];
};

type BuildInvoiceCreditsBreakdownOptions = {
    invoice: Invoice;
    getPeriodTitle: (period: InvoicePeriod) => string;
    getCreditTypeLabel: (credits?: InvoiceCreditQuantity) => string;
    formatQuantity: (quantity?: string) => string;
};

export const buildInvoiceCreditsBreakdown = ({
    invoice,
    getPeriodTitle,
    getCreditTypeLabel,
    formatQuantity,
}: BuildInvoiceCreditsBreakdownOptions): InvoiceCreditsBreakdownPeriod[] => {
    const periods = [...(invoice.periods ?? []), ...(invoice.closed_periods ?? [])];

    return periods
        .map((period) => {
            const walletRowsByLabel = new Map<string, InvoiceCreditsBreakdownRow>();
            const rowKeysByLabel = new Map<string, Set<string>>();

            for (const group of period.groups ?? []) {
                for (const line of group.lines ?? []) {
                    const walletBalanceDetails = line?.details?.wallet_balance_details;

                    if (!walletBalanceDetails) {
                        continue;
                    }

                    const primaryCredit =
                        walletBalanceDetails.used_wallet_credits ??
                        walletBalanceDetails.left_wallet_credits ??
                        walletBalanceDetails.available_wallet_credits;
                    const label = getCreditTypeLabel(primaryCredit);
                    const row = {
                        id: `${period.period_order}-${group.group_order}-${line.line_order}`,
                        label,
                        used: formatQuantity(walletBalanceDetails.used_wallet_credits?.quantity),
                        left: formatQuantity(walletBalanceDetails.left_wallet_credits?.quantity),
                        available: formatQuantity(
                            walletBalanceDetails.available_wallet_credits?.quantity,
                        ),
                    };
                    const rowKey = `${row.label}-${row.used}-${row.left}-${row.available}`;
                    const rowKeys = rowKeysByLabel.get(label) ?? new Set<string>();

                    if (rowKeys.has(rowKey)) {
                        continue;
                    }

                    rowKeys.add(rowKey);
                    rowKeysByLabel.set(label, rowKeys);

                    const walletRow = walletRowsByLabel.get(label) ?? {
                        id: `${period.period_order}-${label}`,
                        label,
                        amount: row.available,
                        rows: [],
                    };

                    walletRow.rows.push(row);
                    walletRowsByLabel.set(label, walletRow);
                }
            }

            return {
                id: `${period.period_order}-${period.start_at}`,
                title: getPeriodTitle(period),
                rows: [...walletRowsByLabel.values()],
            };
        })
        .filter((period) => period.rows.length > 0);
};
