import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import {
    DEFAULT_LOCALE,
    isSupportedLocale,
    loadLocaleMessages,
    supportedLocaleSet,
} from './TranslationProvider.lib';

vi.mock('@solvimon/solvimon-ui/translations/en-US', () => ({
    default: { greeting: 'Hello', farewell: 'Goodbye' },
}));

vi.mock('@/translations/locales/en-US.json', () => ({
    default: { farewell: 'Bye', appName: 'Solvimon' },
}));

const makeLogger = (): Logger => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    capture: vi.fn(),
});

describe('DEFAULT_LOCALE', () => {
    it('is en-US', () => {
        expect(DEFAULT_LOCALE).toBe('en-US');
    });
});

describe('supportedLocaleSet', () => {
    it('contains all supported locales', () => {
        expect(supportedLocaleSet.has('en-US')).toBe(true);
        expect(supportedLocaleSet.has('nl-NL')).toBe(true);
    });

    it('does not contain unsupported locales', () => {
        expect(supportedLocaleSet.has('zz-ZZ')).toBe(false);
        expect(supportedLocaleSet.has('')).toBe(false);
    });
});

describe('isSupportedLocale', () => {
    it('returns true for supported locales', () => {
        expect(isSupportedLocale('en-US')).toBe(true);
        expect(isSupportedLocale('nl-NL')).toBe(true);
    });

    it('returns false for unsupported locales', () => {
        expect(isSupportedLocale('zz-ZZ')).toBe(false);
        expect(isSupportedLocale('')).toBe(false);
    });
});

describe('loadLocaleMessages', () => {
    let logger: Logger;

    beforeEach(() => {
        logger = makeLogger();
    });

    it('merges ui and sdk messages with sdk keys taking precedence', async () => {
        const messages = await loadLocaleMessages('en-US', logger);
        expect(messages).toEqual({
            greeting: 'Hello',
            farewell: 'Bye',
            appName: 'Solvimon',
        });
    });

    it('does not log a warning on success', async () => {
        await loadLocaleMessages('en-US', logger);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('returns an empty object for an unsupported locale', async () => {
        const messages = await loadLocaleMessages('zz-ZZ', logger);
        expect(messages).toEqual({});
    });

    it('logs TRANSLATION_LOAD_FAILED for an unsupported locale', async () => {
        await loadLocaleMessages('zz-ZZ', logger);
        expect(logger.warn).toHaveBeenCalledWith(
            'TRANSLATION_LOAD_FAILED',
            'Failed to load translations for locale "zz-ZZ"',
            {},
            expect.any(Error),
        );
    });
});
