import type { InjectionKey, Ref } from 'vue';
import type { Environment } from '@solvimon/solvimon-types';
import type { LogEntry, Logger, LogLevel, LogSink, SerializedError } from './LoggerProvider.types';

export const LOGGER_PROVIDER_INJECTION_KEY: InjectionKey<Logger> = Symbol('sdkLogger');

export function createCustomElementLogSink(
    sink: LogSink,
    hostRef: Ref<HTMLElement | null>,
): LogSink {
    return (entry) => {
        sink(entry);

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
            message: 'message' in err && typeof err.message === 'string' ? err.message : String(err),
            stack: 'stack' in err && typeof err.stack === 'string' ? err.stack : undefined,
            cause: 'cause' in err ? err.cause : undefined,
        };
    }
    return { message: String(err) };
}

export function createLogger(
    sink: LogSink,
    opts?: { minLevel?: LogLevel; customElementName?: string; environment?: Environment },
): Logger {
    const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
    const min = opts?.minLevel ?? 'info';

    const emit = (
        level: LogLevel,
        code: string,
        message: string,
        context?: Record<string, unknown>,
        err?: unknown,
    ) => {
        if (order[level] < order[min]) return;

        const entry: LogEntry = {
            schemaVersion: 1,
            level,
            code,
            message,
            timestamp: new Date().toISOString(),
            context,
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
            emit('error', code, message, rest, err);
        },
    };
}

export function createLoggingContext(
    context: Record<string, unknown> = {},
    customElementName?: string,
    environment?: Environment,
): Record<string, unknown> {
    return {
        componentName: customElementName,
        environment,
        url: window.location.href,
        ...context,
    };
}
