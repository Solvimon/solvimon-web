import type { IntlMessages } from '@solvimon/solvimon-ui';
import type { LocaleLoader, SupportedLocale } from './TranslationProvider.types';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { SUPPORTED_LOCALES } from '@/translations/supported';

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';

export const supportedLocaleSet: ReadonlySet<string> = new Set(SUPPORTED_LOCALES);

export function isSupportedLocale(locale: string): locale is SupportedLocale {
    return supportedLocaleSet.has(locale);
}

const APP_LOCALE_IMPORTS: Record<SupportedLocale, LocaleLoader> = {
    'en-US': () => import('@/translations/locales/en-US.json'),
    'nl-NL': () => import('@/translations/locales/nl-NL.json'),
};

const UI_LOCALE_IMPORTS: Record<SupportedLocale, LocaleLoader> = {
    'en-US': () => import('@solvimon/solvimon-ui/translations/en-US'),
    'nl-NL': () => import('@solvimon/solvimon-ui/translations/nl-NL'),
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
