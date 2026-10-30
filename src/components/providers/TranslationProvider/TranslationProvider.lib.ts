import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser';
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
    'fr-FR': () => import('@/translations/locales/fr-FR.json'),
};

const UI_LOCALE_IMPORTS: Record<TranslatedLocale, LocaleLoader> = {
    'nl-NL': () => import('@solvimon/solvimon-ui/translations/nl-NL'),
    'de-DE': () => import('@solvimon/solvimon-ui/translations/de-DE'),
    'it-IT': () => import('@solvimon/solvimon-ui/translations/it-IT'),
    'fr-FR': () => import('@solvimon/solvimon-ui/translations/fr-FR'),
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

/**
 * A host's own `messages`, parsed. Every other message is parsed when the SDK is built and the
 * bundle carries no ICU parser, so one is loaded only for a host that passes messages. A message
 * that does not parse is left out, so that its default shows, and logged.
 */
export async function parseHostMessages(
    messages: IntlMessages | undefined,
    logger: Logger,
): Promise<IntlMessages> {
    const entries = Object.entries(messages ?? {});
    if (!entries.length) return {};

    let parse: typeof import('@formatjs/icu-messageformat-parser').parse;
    try {
        ({ parse } = await import('@formatjs/icu-messageformat-parser'));
    } catch (err) {
        logger.warn(
            'TRANSLATION_LOAD_FAILED',
            'Failed to load the parser for the messages passed in, showing the defaults instead',
            {},
            err,
        );
        return {};
    }

    const parsed = entries.flatMap(([id, message]) => {
        try {
            return [[id, parse(message)] as const];
        } catch (err) {
            logger.warn(
                'INVALID_MESSAGE',
                'A message passed in is not a valid ICU message, showing its default instead',
                { id },
                err,
            );
            return [];
        }
    });

    return asIntlMessages(Object.fromEntries(parsed));
}

/**
 * Parsed messages, typed as the `IntlMessages` solvimon-ui's `IntlProvider` takes. That type only
 * names the string form, while formatjs takes both, and in the bundle every message is parsed.
 */
export function asIntlMessages(messages: Record<string, MessageFormatElement[]>): IntlMessages {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return messages as unknown as IntlMessages;
}
