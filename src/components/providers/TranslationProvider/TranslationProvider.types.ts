import type { IntlMessages, IntlProviderProps } from '@solvimon/solvimon-ui';
import type { SUPPORTED_LOCALES } from '@/translations/supported';

export type LocaleMessagesModule = { default: IntlMessages };
export type LocaleLoader = () => Promise<LocaleMessagesModule>;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type TranslationProviderProps = Pick<
    IntlProviderProps,
    'locale' | 'dateLocale' | 'messages'
>;
