import type { IntlProviderProps } from '@solvimon/solvimon-ui';

export type TranslationProviderProps = Pick<IntlProviderProps, 'locale' | 'dateLocale' | 'messages'>;
