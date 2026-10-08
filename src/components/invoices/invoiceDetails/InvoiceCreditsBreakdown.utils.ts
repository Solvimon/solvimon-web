import type { Invoice, InvoicePeriod, WalletBalanceValue } from '@solvimon/solvimon-types';
import {
    getInvoiceWalletBalanceRows,
    getLabelledInvoiceWalletBalanceRows,
} from '@solvimon/solvimon-ui';

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
    creditsLabel: string;
    walletLabel: string;
    formatBalance: (balanceValue?: WalletBalanceValue | null) => string;
};

export const buildInvoiceCreditsBreakdown = ({
    invoice,
    getPeriodTitle,
    creditsLabel,
    walletLabel,
    formatBalance,
}: BuildInvoiceCreditsBreakdownOptions): InvoiceCreditsBreakdownPeriod[] => {
    const periods = [...(invoice.periods ?? []), ...(invoice.closed_periods ?? [])];

    return periods
        .map((period) => {
            const lines = (period.groups ?? []).flatMap((group) => group.lines ?? []);
            const balanceRows = getLabelledInvoiceWalletBalanceRows(
                getInvoiceWalletBalanceRows(lines),
                { creditTypes: invoice.credit_types, creditsLabel, walletLabel },
            );
            const walletRowsByLabel = new Map<string, InvoiceCreditsBreakdownRow>();

            for (const balanceRow of balanceRows) {
                const available = formatBalance(balanceRow.availableBalance);
                const walletRow = walletRowsByLabel.get(balanceRow.label) ?? {
                    id: `${period.period_order}-${balanceRow.label}`,
                    label: balanceRow.label,
                    amount: available,
                    rows: [],
                };

                walletRow.rows.push({
                    id: `${period.period_order}-${balanceRow.key}`,
                    label: balanceRow.label,
                    used: formatBalance(balanceRow.usedBalance),
                    left: formatBalance(balanceRow.leftBalance),
                    available,
                });
                walletRowsByLabel.set(balanceRow.label, walletRow);
            }

            return {
                id: `${period.period_order}-${period.start_at}`,
                title: getPeriodTitle(period),
                rows: [...walletRowsByLabel.values()],
            };
        })
        .filter((period) => period.rows.length > 0);
};
