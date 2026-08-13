import type { IntlMessages, IntlProviderProps } from '@solvimon/solvimon-ui';
import type { ComputedRef } from 'vue';
import type { SUPPORTED_LOCALES } from '@/translations/supported';

export type LocaleMessagesModule = { default: IntlMessages };
export type LocaleLoader = () => Promise<LocaleMessagesModule>;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type TranslationProviderProps = Pick<
    IntlProviderProps,
    'locale' | 'dateLocale' | 'messages'
>;

/**
 * What the app resolved its translations to. Handed down so a part of the tree can re-provide them
 * with a message or two replaced, without having to reload or restate the rest.
 */
export interface TranslationSettings {
    locale: ComputedRef<string>;
    dateLocale: ComputedRef<string | undefined>;
    messages: ComputedRef<IntlMessages>;
}

export interface TranslationOverrideProps {
    /** The messages to replace, by id. Everything else is inherited as it is. */
    messages: IntlMessages;
}
