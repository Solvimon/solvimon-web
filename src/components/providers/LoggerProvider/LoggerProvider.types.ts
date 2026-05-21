export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type SerializedError =
    | { name?: string; message?: string; stack?: string; cause?: unknown }
    | undefined;

export type LogEntry = {
    schemaVersion: 1;
    level: LogLevel;
    code: ErrorCode | WarnCode | string; // stable, consumer-filterable
    message: string; // human readable
    timestamp: string; // ISO
    context?: Record<string, unknown>;
    error?: unknown; // may be an Error object (not JSON-safe)
    errorSerialized?: SerializedError; // JSON-safe summary
};

export type LogSink = (entry: LogEntry) => void;

export type Logger = {
    debug: (code: string, message: string, context?: Record<string, unknown>) => void;
    info: (code: string, message: string, context?: Record<string, unknown>) => void;
    warn: (code: WarnCode, message: string, context?: Record<string, unknown>, err?: unknown) => void;
    error: (
        code: ErrorCode,
        message: string,
        context?: Record<string, unknown>,
        err?: unknown,
    ) => void;
    capture: (
        err: unknown,
        context?: Record<string, unknown> & { code?: ErrorCode; message?: string },
    ) => void;
};

export interface LoggerProviderProps {
    /**
     * The minimum log level to emit.
     */
    logLevel?: LogLevel;
    /**
     * The function to call when a log is emitted.
     */
    onLog?: LogSink;
}

export type WarnCode =
    | 'ADYEN_INVALID_CONFIGURATION'
    | 'APPLE_PAY_ACTION_REQUIRED';

export type ErrorCode =
    | 'UNHANDLED_ERROR'
    | 'RESOURCE_REVOKED'
    | 'INVALID_EMAIL'
    | 'INVALID_COUNTRY_CODE'
    | 'PAYMENT_INTEGRATION_INITIALIZATION_FAILED'
    | 'PAYMENT_AUTHORIZATION_FAILED'
    | 'TOKENIZATION_FAILED'
    | 'INVALID_TOKEN'
    | 'INVALID_REDIRECT_RESULT'
    | 'PAYMENT_DETAILS_CALL_FAILED'
    | 'INTEGRATION_ERROR'
    | 'EXPRESS_CHECKOUT_GOOGLE_PAY_ERROR'
    | 'EXPRESS_CHECKOUT_PAYPAL_ERROR'
    | 'APPLE_PAY_ERROR'
    | 'APPLE_PAY_AUTHORIZATION_FAILED'
    | 'PROMOTION_CODE_APPLY_FAILED'
    | 'PROMOTION_CODE_REMOVE_FAILED';
