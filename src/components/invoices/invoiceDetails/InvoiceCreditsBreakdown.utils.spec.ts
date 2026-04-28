import { describe, expect, it } from 'vitest';
import type { Invoice } from '@solvimon/solvimon-types';
import { buildInvoiceCreditsBreakdown } from './InvoiceCreditsBreakdown.utils';

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
                                    wallet_balance_details: {
                                        used_wallet_credits: {
                                            quantity: '10',
                                            credit_type_id: 'ctyp_1',
                                        },
                                        left_wallet_credits: {
                                            quantity: '90',
                                            credit_type_id: 'ctyp_1',
                                        },
                                        available_wallet_credits: {
                                            quantity: '100',
                                            credit_type_id: 'ctyp_1',
                                        },
                                    },
                                },
                            },
                            {
                                line_order: 2,
                                details: {
                                    wallet_balance_details: {
                                        used_wallet_credits: {
                                            quantity: '10',
                                            credit_type_id: 'ctyp_1',
                                        },
                                        left_wallet_credits: {
                                            quantity: '90',
                                            credit_type_id: 'ctyp_1',
                                        },
                                        available_wallet_credits: {
                                            quantity: '100',
                                            credit_type_id: 'ctyp_1',
                                        },
                                    },
                                },
                            },
                            {
                                line_order: 3,
                                details: {
                                    wallet_balance_details: {
                                        used_wallet_credits: {
                                            quantity: '5',
                                            credit_type_id: 'legacy_credits',
                                        },
                                        left_wallet_credits: {
                                            quantity: '45',
                                            credit_type_id: 'legacy_credits',
                                        },
                                        available_wallet_credits: {
                                            quantity: '50',
                                            credit_type_id: 'legacy_credits',
                                        },
                                    },
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
                                    wallet_balance_details: {
                                        available_wallet_credits: {
                                            quantity: '25',
                                        },
                                    },
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
    }) as Invoice;

const getPeriodTitle = (period: { period_order: number }) => `Period ${period.period_order}`;
const getCreditTypeLabel = (credits?: {
    credit_type_id?: string;
}) => {
    if (!credits?.credit_type_id) {
        return 'Credits';
    }

    return credits.credit_type_id === 'ctyp_1' ? 'OpenAI credits' : credits.credit_type_id;
};
const formatQuantity = (quantity?: string) => (quantity ? `formatted:${quantity}` : '-');

describe('buildInvoiceCreditsBreakdown', () => {
    it('groups wallet balance rows by credit type and removes duplicate rows per label', () => {
        const periods = buildInvoiceCreditsBreakdown({
            invoice: createInvoice(),
            getPeriodTitle,
            getCreditTypeLabel,
            formatQuantity,
        });

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
                            id: '1-1-1',
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
                            id: '1-1-3',
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

    it('falls back to the default credit label and placeholder quantities when data is partial', () => {
        const periods = buildInvoiceCreditsBreakdown({
            invoice: createInvoice(),
            getPeriodTitle,
            getCreditTypeLabel,
            formatQuantity,
        });

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
                            id: '2-1-1',
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

    it('omits periods that do not contain wallet balance rows', () => {
        const periods = buildInvoiceCreditsBreakdown({
            invoice: createInvoice(),
            getPeriodTitle,
            getCreditTypeLabel,
            formatQuantity,
        });

        expect(periods.map((period) => period.title)).toEqual(['Period 1', 'Period 2']);
    });
});
