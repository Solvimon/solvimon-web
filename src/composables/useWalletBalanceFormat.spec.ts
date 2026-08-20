import type { CustomerWalletBalanceItem, WalletBalanceValue } from '@solvimon/solvimon-types';
import { useWalletBalanceFormat } from './useWalletBalanceFormat';

// The real formatting is kept; only the intl context is stood in for, as it is in component specs.
vi.mock('@solvimon/solvimon-ui', async () => {
    const actual =
        await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    const { mockUseIntl } = await import('@/test-utils/useIntlMock');

    return { ...actual, useIntl: mockUseIntl };
});

/** Credits of a wallet whose credit type is named coin/coins. */
const creditsOf = (quantity: string) =>
    ({
        credits: {
            quantity,
            credit_type_id: 'ctyp_1',
            credit_type: { unit_name: { singular: 'coin', plural: 'coins' } },
        },
    }) as unknown as WalletBalanceValue;

const balanceItemOf = (openBalance: unknown) =>
    ({ wallet_balance: { open_balance: openBalance } }) as CustomerWalletBalanceItem;

describe('useWalletBalanceFormat', () => {
    it('names credits as the wallet names them', () => {
        expect(useWalletBalanceFormat().formatValue(creditsOf('1000'))).toBe('1000 coins');
    });

    it('formats a money balance as money', () => {
        expect(
            useWalletBalanceFormat().formatValue({
                amount: { quantity: '10.00', currency: 'EUR' },
            }),
        ).toBe('€10.00');
    });

    // What is left to spend, rather than what was ever granted, is what a customer means by balance.
    it('reads the open balance off a wallet', () => {
        const { formatOpenBalance } = useWalletBalanceFormat();

        expect(formatOpenBalance(balanceItemOf(creditsOf('250')))).toBe('250 coins');
    });

    it('says so where there is no balance to read', () => {
        const { formatValue, formatOpenBalance } = useWalletBalanceFormat();

        expect(formatOpenBalance(undefined)).toBe('N/A');
        expect(formatValue(null)).toBe('N/A');
    });
});
