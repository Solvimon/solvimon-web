import type { IntlMessages } from '@solvimon/solvimon-ui';
import type { InjectionKey } from 'vue';
import type {
    LocaleLoader,
    SupportedLocale,
    TranslationSettings,
} from './TranslationProvider.types';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { SUPPORTED_LOCALES } from '@/translations/supported';

export const DEFAULT_LOCALE = 'en-US' satisfies SupportedLocale;

export const TRANSLATION_SETTINGS_KEY: InjectionKey<TranslationSettings> =
    Symbol('translation-settings');

export const supportedLocaleSet: ReadonlySet<string> = new Set(SUPPORTED_LOCALES);

export function isSupportedLocale(locale: string): locale is SupportedLocale {
    return supportedLocaleSet.has(locale);
}

/**
 * A locale the SDK has no catalogue for — `nl` or `en-GB` rather than `nl-NL` — renders in
 * en-US, which a host would otherwise only find out about from a customer.
 */
export function warnIfUnsupportedLocale(locale: string | undefined, logger: Logger): void {
    if (!locale || isSupportedLocale(locale)) return;

    logger.warn('UNSUPPORTED_LOCALE', 'The locale is not supported, showing en-US instead', {
        locale,
        supportedLocales: [...SUPPORTED_LOCALES],
    });
}

type TranslatedLocale = Exclude<SupportedLocale, typeof DEFAULT_LOCALE>;

const APP_LOCALE_IMPORTS: Record<TranslatedLocale, LocaleLoader> = {
    'nl-NL': () => import('@/translations/locales/nl-NL.json'),
    'de-DE': () => import('@/translations/locales/de-DE.json'),
    'it-IT': () => import('@/translations/locales/it-IT.json'),
};

const UI_LOCALE_IMPORTS: Record<TranslatedLocale, LocaleLoader> = {
    'nl-NL': () => import('@solvimon/solvimon-ui/translations/nl-NL'),
    'de-DE': () => import('@solvimon/solvimon-ui/translations/de-DE'),
    'it-IT': () => import('@solvimon/solvimon-ui/translations/it-IT'),
};

export async function loadLocaleMessages(locale: string, logger: Logger): Promise<IntlMessages> {
    if (!isSupportedLocale(locale)) {
        const err = new Error(`No import registered for locale "${locale}"`);
        logger.warn(
            'TRANSLATION_LOAD_FAILED',
            `Failed to load translations for locale "${locale}"`,
            {},
            err,
        );
        return {};
    }

    // en-US is what every SDK `defaultMessage` says, and the UI bundles its own en-US messages.
    if (locale === DEFAULT_LOCALE) {
        return {};
    }

    try {
        const [{ default: ui }, { default: local }] = await Promise.all([
            UI_LOCALE_IMPORTS[locale](),
            APP_LOCALE_IMPORTS[locale](),
        ]);
        return { ...ui, ...local };
    } catch (err) {
        logger.warn(
            'TRANSLATION_LOAD_FAILED',
            `Failed to load translations for locale "${locale}"`,
            {},
            err,
        );
        return {};
    }
}
