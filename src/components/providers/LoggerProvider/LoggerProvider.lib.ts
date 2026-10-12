import type { InjectionKey, Ref } from 'vue';
import type { Environment } from '@solvimon/solvimon-types';
import type { LogEntry, Logger, LogLevel, LogSink, SerializedError } from './LoggerProvider.types';
import { getSessionReference } from '@/utils/sessionReference';

export const LOGGER_PROVIDER_INJECTION_KEY: InjectionKey<Logger> = Symbol('sdkLogger');

/**
 * Mirrors log entries to the browser console.
 *
 * The SDK reports through the consumer's `onLog` handler and a `log` custom event, so nothing is
 * visible while developing an integration that does neither. Reserved for non-production
 * environments to keep consumers' consoles clean.
 *
 * Log context ends up in the console verbatim, so never put tokens or credentials in it.
 */
export function createConsoleLogSink(): LogSink {
    return ({ level, code, message, context, error }) => {
        /* eslint-disable no-console -- this sink exists to make SDK logs visible while developing */
        const write =
            level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
        /* eslint-enable no-console */

        write(
            `[solvimon] ${code}: ${message}`,
            ...(context ? [context] : []),
            ...(error ? [error] : []),
        );
    };
}

/**
 * A sink that throws, which is usually the host's own `onLog`, must not replace the failure being
 * logged or keep the other sinks from running. Its error is rethrown outside the SDK's call stack,
 * where the host's own error reporting sees it.
 */
function runSink(sink: LogSink, entry: LogEntry): void {
    try {
        sink(entry);
    } catch (error) {
        setTimeout(() => {
            throw error;
        });
    }
}

/** Fans an entry out to every sink, so console output can sit next to the consumer's own. */
export function combineLogSinks(...sinks: LogSink[]): LogSink {
    return (entry) => sinks.forEach((sink) => runSink(sink, entry));
}

export function createCustomElementLogSink(
    sink: LogSink,
    hostRef: Ref<HTMLElement | null>,
): LogSink {
    return (entry) => {
        runSink(sink, entry);

        if (!hostRef.value) {
            return;
        }

        hostRef.value.dispatchEvent(
            new CustomEvent('log', {
                detail: entry,
                bubbles: true,
                cancelable: true,
                composed: true,
            }),
        );
    };
}

export function serializeError(err: unknown): SerializedError {
    if (!err) return undefined;
    if (err instanceof Error) {
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
            cause: err.cause,
        };
    }
    if (typeof err === 'object') {
        return {
            name: 'name' in err && typeof err.name === 'string' ? err.name : undefined,
            message:
                'message' in err && typeof err.message === 'string' ? err.message : String(err),
            stack: 'stack' in err && typeof err.stack === 'string' ? err.stack : undefined,
            cause: 'cause' in err ? err.cause : undefined,
        };
    }
    return { message: String(err) };
}

/**
 * A fingerprint travels in the context because that is the only channel `logger.error` has, and is
 * lifted back out because a consumer needs it as a grouping key, not as one more context tag.
 */
export function extractFingerprint(context?: Record<string, unknown>): {
    fingerprint?: string[];
    context?: Record<string, unknown>;
} {
    if (!context || !('fingerprint' in context)) {
        return { context };
    }

    const { fingerprint, ...rest } = context;
    const isStringArray =
        Array.isArray(fingerprint) && fingerprint.every((part) => typeof part === 'string');

    return isStringArray ? { fingerprint, context: rest } : { context: rest };
}

export function createLogger(
    sink: LogSink,
    opts?: {
        logLevel?: LogLevel;
        customElementName?: string;
        environment?: Environment;
        /** Overridable so a test can assert against a known value; otherwise the session's own. */
        reference?: string;
    },
): Logger {
    const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
    const reference = opts?.reference ?? getSessionReference();

    const emit = (
        level: LogLevel,
        code: string,
        message: string,
        context?: Record<string, unknown>,
        err?: unknown,
    ) => {
        // Read per entry, like `environment` below: a host may set either after the element mounted.
        if (order[level] < order[opts?.logLevel ?? 'warn']) return;

        const { fingerprint, context: entryContext } = extractFingerprint(context);

        const entry: LogEntry = {
            schemaVersion: 1,
            level,
            code,
            message,
            timestamp: new Date().toISOString(),
            reference,
            context: entryContext,
            ...(fingerprint ? { fingerprint } : {}),
            error: err,
            errorSerialized: serializeError(err),
        };
        sink(entry);
    };

    return {
        debug: (code, message, context) => {
            emit(
                'debug',
                code,
                message,
                createLoggingContext(context, opts?.customElementName, opts?.environment),
            );
        },
        info: (code, message, context) => {
            emit(
                'info',
                code,
                message,
                createLoggingContext(context, opts?.customElementName, opts?.environment),
            );
        },
        warn: (code, message, context, err) => {
            emit(
                'warn',
                code,
                message,
                createLoggingContext(context, opts?.customElementName, opts?.environment),
                err,
            );
        },
        error: (code, message, context, err) => {
            emit(
                'error',
                code,
                message,
                createLoggingContext(context, opts?.customElementName, opts?.environment),
                err,
            );
        },
        capture: (err, context) => {
            const code = context?.code ?? 'UNHANDLED_ERROR';
            const message = context?.message ?? 'Unhandled error';
            const { code: _c, message: _m, ...rest } = context ?? {};
            emit(
                'error',
                code,
                message,
                createLoggingContext(rest, opts?.customElementName, opts?.environment),
                err,
            );
        },
    };
}

export function createLoggingContext(
    context: Record<string, unknown> = {},
    customElementName?: string,
    environment?: Environment,
): Record<string, unknown> {
    // Intentionally don't include query string, since that probably contains user specific data.
    const url = window.location.origin + window.location.pathname;

    return {
        componentName: customElementName,
        environment,
        url,
        ...context,
    };
}
