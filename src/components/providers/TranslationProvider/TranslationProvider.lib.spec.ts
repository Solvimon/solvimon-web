import { describe, it, expect, vi, beforeEach } from 'vitest';
import uiCatalogue from '@solvimon/solvimon-ui/translations/en-US';
import {
    DEFAULT_LOCALE,
    isSupportedLocale,
    loadLocaleMessages,
    supportedLocaleSet,
    warnIfUnsupportedLocale,
} from './TranslationProvider.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import sdkSource from '@/translations/source.json';

const uiMessages: Record<string, string> = uiCatalogue;

vi.mock('@solvimon/solvimon-ui/translations/nl-NL', () => ({
    default: { greeting: 'Hallo', farewell: 'Tot ziens' },
}));

vi.mock('@/translations/locales/nl-NL.json', () => ({
    default: { farewell: 'Doei', appName: 'Solvimon' },
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
        expect(supportedLocaleSet.has('de-DE')).toBe(true);
        expect(supportedLocaleSet.has('it-IT')).toBe(true);
        expect(supportedLocaleSet.has('fr-FR')).toBe(true);
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
        expect(isSupportedLocale('de-DE')).toBe(true);
        expect(isSupportedLocale('it-IT')).toBe(true);
        expect(isSupportedLocale('fr-FR')).toBe(true);
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
        const messages = await loadLocaleMessages('nl-NL', logger);
        expect(messages).toEqual({
            greeting: 'Hallo',
            farewell: 'Doei',
            appName: 'Solvimon',
        });
    });

    // The UI does not export a French catalogue yet, so French is the SDK's own messages alone.
    it("loads the sdk's french messages", async () => {
        const messages = await loadLocaleMessages('fr-FR', logger);

        expect(messages['checkout.pay_and_subscribe_button.label']).toBe('Payer et s’abonner');
        expect(logger.warn).not.toHaveBeenCalled();
    });

    // Every element waits for its catalogue before it renders, so en-US must not need a download.
    it('loads no catalogue for en-US', async () => {
        const messages = await loadLocaleMessages('en-US', logger);
        expect(messages).toEqual({});
    });

    // Without an en-US catalogue, the UI's en-US text shows for an id both define, where the SDK's
    // catalogue wins in every other locale.
    it('words every id the ui also defines as the ui does in en-US', () => {
        const shared = Object.entries(sdkSource).filter(([id]) => id in uiMessages);

        expect(shared.length).toBeGreaterThan(0);
        for (const [id, { defaultMessage }] of shared) {
            expect({ id, defaultMessage }).toEqual({ id, defaultMessage: uiMessages[id] });
        }
    });

    it('does not log a warning on success', async () => {
        await loadLocaleMessages('nl-NL', logger);
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

describe('warnIfUnsupportedLocale', () => {
    it.each(['nl', 'en-GB'])('warns that %s falls back to en-US', (locale) => {
        const logger = makeLogger();

        warnIfUnsupportedLocale(locale, logger);

        expect(logger.warn).toHaveBeenCalledWith(
            'UNSUPPORTED_LOCALE',
            expect.stringContaining('en-US'),
            expect.objectContaining({ locale }),
        );
    });

    it.each([undefined, 'nl-NL', 'en-US'])('says nothing about %s', (locale) => {
        const logger = makeLogger();

        warnIfUnsupportedLocale(locale, logger);

        expect(logger.warn).not.toHaveBeenCalled();
    });
});
