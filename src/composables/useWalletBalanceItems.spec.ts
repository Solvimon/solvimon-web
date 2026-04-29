import type { CustomerWalletBalancesResponse } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import { useWalletBalanceItems } from './useWalletBalanceItems';

vi.mock('@solvimon/solvimon-ui', () => ({
    useIntl: () => ({
        $t: (message: { defaultMessage: string }) => message.defaultMessage,
    }),
}));

describe('useWalletBalanceItems', () => {
    it('maps customer wallet balances to wallet balance list items', () => {
        const walletBalances = ref<CustomerWalletBalancesResponse | null>({
            balance_at: '2026-04-28T08:00:00.000Z',
            wallet_balances: [
                {
                    wallet_id: 'wallet_prepaid',
                    wallet_balance: {
                        open_balance: {
                            amount: {
                                quantity: '1250.5',
                                currency: 'EUR',
                            },
                        },
                        balance_at: '2026-04-28T09:00:00.000Z',
                    },
                },
                {
                    wallet_id: 'wallet_credits',
                    wallet_balance: {
                        open_balance: {
                            credits: {
                                quantity: '2400',
                                credit_type_id: 'ctyp_api',
                            },
                        },
                    },
                },
            ],
        } satisfies CustomerWalletBalancesResponse);

        const items = useWalletBalanceItems(walletBalances);

        expect(items.value).toStrictEqual([
            {
                walletId: 'wallet_prepaid',
                title: 'Balance',
                balance: {
                    amount: {
                        quantity: '1250.5',
                        currency: 'EUR',
                    },
                },
                balanceAt: '2026-04-28T09:00:00.000Z',
            },
            {
                walletId: 'wallet_credits',
                title: 'Balance',
                balance: {
                    credits: {
                        quantity: '2400',
                        credit_type_id: 'ctyp_api',
                    },
                },
                balanceAt: '2026-04-28T08:00:00.000Z',
            },
        ]);
    });

    it('returns an empty list without wallet balances', () => {
        const walletBalances = ref<CustomerWalletBalancesResponse | null>(null);
        const items = useWalletBalanceItems(walletBalances);

        expect(items.value).toStrictEqual([]);
    });

    it('uses null for balanceAt when no item or response timestamp exists', () => {
        const walletBalances = ref<CustomerWalletBalancesResponse | null>({
            wallet_balances: [
                {
                    wallet_id: 'wallet_without_timestamp',
                    wallet_balance: {
                        open_balance: null,
                    },
                },
            ],
        } satisfies CustomerWalletBalancesResponse);

        const items = useWalletBalanceItems(walletBalances);

        expect(items.value).toStrictEqual([
            {
                walletId: 'wallet_without_timestamp',
                title: 'Balance',
                balance: null,
                balanceAt: null,
            },
        ]);
    });
});
