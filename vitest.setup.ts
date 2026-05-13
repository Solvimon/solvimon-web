import { vi } from 'vitest';

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual = await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    const { mockUseIntl } = await import('./src/test-utils/useIntlMock');

    return {
        ...actual,
        useIntl: mockUseIntl,
    };
});
