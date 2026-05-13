export const createSolvimonUiMock = async (additionalStubs: Record<string, unknown> = {}) => {
    const actual = await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    const { mockUseIntl } = await import('./useIntlMock');
    return {
        ...actual,
        useIntl: mockUseIntl,
        ...additionalStubs,
    };
};
