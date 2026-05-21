import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

vi.mock('@solvimon/solvimon-ui', async () => {
    const actual = await vi.importActual<typeof import('@solvimon/solvimon-ui')>('@solvimon/solvimon-ui');
    const { mockUseIntl } = await import('./src/test-utils/useIntlMock');

    return {
        ...actual,
        useIntl: mockUseIntl,
    };
});
