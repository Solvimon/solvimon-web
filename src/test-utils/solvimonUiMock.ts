export const createSolvimonUiMock = async (additionalStubs: Record<string, unknown> = {}) => {
    const actual =
        await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    const { mockUseIntl } = await import('./useIntlMock');
    return {
        ...actual,
        useIntl: mockUseIntl,
        // Resolves its messages through solvimon-ui's own IntlProvider, which specs do not mount.
        useChargeOnDemandPriceLabel: () => ({
            getPriceLabel: ({
                price,
                priceType,
            }: import('@solvimon/solvimon-ui').ChargeOnDemandItem) =>
                price
                    ? `${actual.formatAmount(price)} ${priceType === 'FLAT' ? 'per unit' : 'one-off'}`
                    : undefined,
        }),
        ...additionalStubs,
    };
};
