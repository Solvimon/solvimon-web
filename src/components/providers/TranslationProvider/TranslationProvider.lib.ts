import type { IntlMessages } from '@solvimon/solvimon-ui';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import supportedLocales from '@/translations/supported.json';

export const supportedLocaleSet: ReadonlySet<string> = new Set(supportedLocales);

export async function loadLocaleMessages(locale: string, logger: Logger): Promise<IntlMessages> {
    try {
        const [{ default: ui }, { default: sdk }] = await Promise.all([
            import(`@solvimon/solvimon-ui/translations/${locale}`),
            import(`@/translations/${locale}.json`),
        ]);
        return { ...ui, ...sdk };
    } catch (err) {
        logger.warn('TRANSLATION_LOAD_FAILED', `Failed to load translations for locale "${locale}"`, {}, err);
        return {};
    }
}
