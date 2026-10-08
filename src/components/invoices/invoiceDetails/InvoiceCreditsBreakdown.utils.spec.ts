import { describe, expect, it } from 'vitest';
import type { Invoice, InvoiceWalletBalance, WalletBalanceValue } from '@solvimon/solvimon-types';
import { buildInvoiceCreditsBreakdown } from './InvoiceCreditsBreakdown.utils';

const credits = (quantity: string, credit_type_id?: string): WalletBalanceValue => ({
    credits: { quantity, credit_type_id },
});

const money = (quantity: string, currency = 'EUR'): WalletBalanceValue => ({
    amount: { quantity, currency },
});

const creditsWalletBalance = (
    wallet_id: string,
    creditTypeId: string,
    [used, left, available]: [string, string, string],
): InvoiceWalletBalance => ({
    wallet_id,
    used_balance: credits(used, creditTypeId),
    left_balance: credits(left, creditTypeId),
    available_balance: credits(available, creditTypeId),
});

const createInvoice = (): Invoice =>
    ({
        customer: {
            timezone: 'Europe/Amsterdam',
        },
        credit_types: [
            {
                id: 'ctyp_1',
                name: 'OpenAI credits',
            },
        ],
        periods: [
            {
                period_order: 1,
                start_at: '2026-04-01T00:00:00Z',
                end_at: '2026-04-30T23:59:59Z',
                groups: [
                    {
                        group_order: 1,
                        lines: [
                            {
                                line_order: 1,
                                details: {
                                    wallet_balances: [
                                        creditsWalletBalance('wal_1', 'ctyp_1', [
                                            '10',
                                            '90',
                                            '100',
                                        ]),
                                    ],
                                },
                            },
                            {
                                line_order: 2,
                                details: {
                                    wallet_balances: [
                                        creditsWalletBalance('wal_1', 'ctyp_1', [
                                            '10',
                                            '90',
                                            '100',
                                        ]),
                                    ],
                                },
                            },
                            {
                                line_order: 3,
                                details: {
                                    wallet_balances: [
                                        creditsWalletBalance('wal_2', 'legacy_credits', [
                                            '5',
                                            '45',
                                            '50',
                                        ]),
                                    ],
                                },
                            },
                            {
                                line_order: 4,
                                details: {},
                            },
                        ],
                    },
                ],
            },
        ],
        closed_periods: [
            {
                period_order: 2,
                start_at: '2026-03-01T00:00:00Z',
                end_at: '2026-03-31T23:59:59Z',
                groups: [
                    {
                        group_order: 1,
                        lines: [
                            {
                                line_order: 1,
                                details: {
                                    wallet_balances: [
                                        {
                                            wallet_id: 'wal_3',
                                            available_balance: credits('25'),
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            },
            {
                period_order: 3,
                start_at: '2026-02-01T00:00:00Z',
                end_at: '2026-02-28T23:59:59Z',
                groups: [],
            },
        ],
    }) as unknown as Invoice;

const createMoneyWalletInvoice = (): Invoice =>
    ({
        customer: {
            timezone: 'Europe/Amsterdam',
        },
        credit_types: [
            {
                id: 'ctyp_1',
                name: 'OpenAI credits',
            },
        ],
        periods: [
            {
                period_order: 1,
                start_at: '2026-04-01T00:00:00Z',
                end_at: '2026-04-30T23:59:59Z',
                groups: [
                    {
                        group_order: 1,
                        lines: [
                            {
                                line_order: 1,
                                details: {
                                    wallet_balances: [
                                        {
                                            wallet_id: 'wal_eur',
                                            used_balance: money('12.50'),
                                            left_balance: money('80.00'),
                                            available_balance: money('100.00'),
                                        },
                                    ],
                                },
                            },
                            {
                                line_order: 2,
                                details: {
                                    wallet_balances: [
                                        {
                                            wallet_id: 'wal_eur',
                                            used_balance: money('7.50'),
                                            left_balance: money('80.00'),
                                            available_balance: money('100.00'),
                                        },
                                        creditsWalletBalance('wal_1', 'ctyp_1', ['3', '7', '10']),
                                    ],
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    }) as unknown as Invoice;

const getPeriodTitle = (period: { period_order: number }) => `Period ${period.period_order}`;
const formatBalance = (balanceValue?: WalletBalanceValue | null) => {
    if (balanceValue?.amount) {
        return `${balanceValue.amount.currency} ${balanceValue.amount.quantity}`;
    }

    return balanceValue?.credits ? `formatted:${balanceValue.credits.quantity}` : '-';
};
const build = (invoice: Invoice) =>
    buildInvoiceCreditsBreakdown({
        invoice,
        getPeriodTitle,
        creditsLabel: 'Credits',
        walletLabel: 'Wallet',
        formatBalance,
    });

describe('buildInvoiceCreditsBreakdown', () => {
    it('groups wallet balance rows by credit type and keeps a repeated snapshot once', () => {
        const periods = build(createInvoice());

        expect(periods).toHaveLength(2);
        expect(periods[0]).toEqual({
            id: '1-2026-04-01T00:00:00Z',
            title: 'Period 1',
            rows: [
                {
                    id: '1-OpenAI credits',
                    label: 'OpenAI credits',
                    amount: 'formatted:100',
                    rows: [
                        {
                            id: expect.stringMatching(/^1-wal_1\|/),
                            label: 'OpenAI credits',
                            used: 'formatted:10',
                            left: 'formatted:90',
                            available: 'formatted:100',
                        },
                    ],
                },
                {
                    id: '1-legacy_credits',
                    label: 'legacy_credits',
                    amount: 'formatted:50',
                    rows: [
                        {
                            id: expect.stringMatching(/^1-wal_2\|/),
                            label: 'legacy_credits',
                            used: 'formatted:5',
                            left: 'formatted:45',
                            available: 'formatted:50',
                        },
                    ],
                },
            ],
        });
    });

    it('falls back to the default credit label and placeholder values when data is partial', () => {
        const periods = build(createInvoice());

        expect(periods[1]).toEqual({
            id: '2-2026-03-01T00:00:00Z',
            title: 'Period 2',
            rows: [
                {
                    id: '2-Credits',
                    label: 'Credits',
                    amount: 'formatted:25',
                    rows: [
                        {
                            id: expect.stringMatching(/^2-wal_3\|/),
                            label: 'Credits',
                            used: '-',
                            left: '-',
                            available: 'formatted:25',
                        },
                    ],
                },
            ],
        });
    });

    it('shows a money wallet as money, summing what it paid across lines', () => {
        const [period] = build(createMoneyWalletInvoice());

        expect(period?.rows).toEqual([
            {
                id: '1-Wallet',
                label: 'Wallet',
                amount: 'EUR 100.00',
                rows: [
                    {
                        id: '1-wal_eur|EUR',
                        label: 'Wallet',
                        used: 'EUR 20.00',
                        left: 'EUR 80.00',
                        available: 'EUR 100.00',
                    },
                ],
            },
            {
                id: '1-OpenAI credits',
                label: 'OpenAI credits',
                amount: 'formatted:10',
                rows: [
                    {
                        id: expect.stringMatching(/^1-wal_1\|/),
                        label: 'OpenAI credits',
                        used: 'formatted:3',
                        left: 'formatted:7',
                        available: 'formatted:10',
                    },
                ],
            },
        ]);
    });

    it('omits periods that do not contain wallet balance rows', () => {
        const periods = build(createInvoice());

        expect(periods.map((period) => period.title)).toEqual(['Period 1', 'Period 2']);
    });
});
