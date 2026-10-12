import { createIntl, createIntlCache } from '@formatjs/intl';
import type { IntlConfig, MessageDescriptor } from '@formatjs/intl';
import enUS from '@/translations/locales/en-US.json';

type MessageValues = Record<
    string,
    string | number | boolean | null | undefined | Date | ((chunks: string[]) => string)
>;

/**
 * A missing translation falls back to `defaultMessage`, as it does in production. Anything else
 * (an unparsable message, a placeholder without a value, a tag without a handler) is a bug that
 * production would only log and render verbatim, so a spec fails on it instead.
 */
export const throwOnIntlError: IntlConfig['onError'] = (error) => {
    if (error.code === 'MISSING_TRANSLATION') return;
    throw error;
};

const cache = createIntlCache();

const intl = createIntl(
    { locale: 'en-US', defaultLocale: 'en-US', messages: enUS, onError: throwOnIntlError },
    cache,
);

const formatMessage = (message: MessageDescriptor, values?: MessageValues): string => {
    const formatted = intl.formatMessage(message, values);
    return Array.isArray(formatted) ? formatted.join('') : String(formatted);
};

export const mockUseIntl = () => ({
    $t: formatMessage,
    formatDate: ({
        date,
        format,
        timezone,
    }: {
        date: Date | string;
        format: 'date' | 'dateTime';
        timezone?: string;
    }) => {
        const options: Intl.DateTimeFormatOptions =
            format === 'date'
                ? { day: '2-digit', month: '2-digit', year: 'numeric' }
                : {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                  };
        return new Intl.DateTimeFormat('en-GB', {
            ...options,
            ...(timezone ? { timeZone: timezone } : {}),
        }).format(new Date(date));
    },
    formatMessage,
    formatNumber: (n: number) => String(n),
});
