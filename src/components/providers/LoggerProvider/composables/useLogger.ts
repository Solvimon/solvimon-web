import { inject } from 'vue';
import { LOGGER_PROVIDER_INJECTION_KEY } from '@/components/providers/LoggerProvider/LoggerProvider.lib';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';

/**
 * Returns the logger instance to be used for all logging operations
 * (info, debug, warn, error, capture).
 */
export function useLogger(): Logger {
    const logger = inject(LOGGER_PROVIDER_INJECTION_KEY, null);
    if (logger) return logger;

    // Safe fallback: no-op logger so internal code can call it without crashing.
    const noop = () => {};
    return { debug: noop, info: noop, warn: noop, error: noop, capture: noop } as Logger;
}
