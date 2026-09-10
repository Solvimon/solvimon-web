export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type SerializedError =
    | { name?: string; message?: string; stack?: string; cause?: unknown }
    | undefined;

export type LogEntry = {
    /**
     * The shape of this entry. Bumped when a field changes meaning or goes away, so a consumer can
     * guard against a version they were not written for rather than reading a field that moved.
     */
    schemaVersion: 1;
    /** How severe the SDK considers it. Entries below `LoggerProvider`'s `logLevel` never arrive. */
    level: LogLevel;
    /**
     * What happened, as a stable identifier. Filter and branch on this rather than on `message`:
     * codes are part of the SDK's contract and are listed in the README, messages are not and are
     * reworded freely. A `string` is accepted alongside the known codes because `debug` and `info`
     * entries carry ad-hoc ones.
     */
    code: ErrorCode | WarnCode | string;
    /** A human-readable line for a person reading logs. Not stable — never match on it. */
    message: string;
    /** When the entry was created, as an ISO 8601 string. */
    timestamp: string;
    /**
     * Whatever the call site thought was worth knowing, plus the `componentName`, `environment` and
     * `url` every entry is enriched with. The URL is origin and path only — the query string is
     * left off because it tends to carry customer data. Never contains tokens or credentials.
     */
    context?: Record<string, unknown>;
    /**
     * How the entry should be grouped where a consumer aggregates them — Sentry's `fingerprint`, or
     * whatever theirs calls it. Set it when the `code` alone would collapse unrelated incidents
     * into one issue, or split one across many. Passed as a `fingerprint` key on the log context.
     */
    fingerprint?: string[];
    /**
     * The thrown value behind the entry, untouched — usually an `Error`, but the SDK passes on
     * whatever it caught. Not JSON-safe: serializing it directly tends to yield `{}`, so use
     * `errorSerialized` for anything that leaves the browser.
     */
    error?: unknown;
    /** The same failure flattened to plain fields, for sending onwards or writing down. */
    errorSerialized?: SerializedError;
};

export type LogSink = (entry: LogEntry) => void;

export type Logger = {
    debug: (code: string, message: string, context?: Record<string, unknown>) => void;
    info: (code: string, message: string, context?: Record<string, unknown>) => void;
    warn: (
        code: WarnCode,
        message: string,
        context?: Record<string, unknown>,
        err?: unknown,
    ) => void;
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
    | 'ACTIVE_SCHEDULE_NOT_FOUND'
    | 'ADYEN_INVALID_CONFIGURATION'
    | 'PAYMENT_INTEGRATION_NOT_RENDERABLE'
    | 'APPLE_PAY_ACTION_REQUIRED'
    | 'INVOICE_PREVIEW_SKIPPED'
    | 'TRANSLATION_LOAD_FAILED';

export type ErrorCode =
    | 'UNHANDLED_ERROR'
    | 'RESOURCE_REVOKED'
    | 'INVALID_EMAIL'
    | 'INVALID_COUNTRY_CODE'
    | 'PAYMENT_INTEGRATION_INITIALIZATION_FAILED'
    | 'PAYMENT_AUTHORIZATION_FAILED'
    | 'TOKENIZATION_FAILED'
    | 'INVALID_TOKEN'
    | 'SESSION_EXPIRED'
    | 'INVALID_REDIRECT_RESULT'
    | 'PAYMENT_DETAILS_CALL_FAILED'
    | 'PAYMENT_METHOD_OPTIONS_LOAD_FAILED'
    | 'INTEGRATION_ERROR'
    | 'EXPRESS_CHECKOUT_GOOGLE_PAY_ERROR'
    | 'EXPRESS_CHECKOUT_PAYPAL_ERROR'
    | 'APPLE_PAY_ERROR'
    | 'APPLE_PAY_AUTHORIZATION_FAILED'
    | 'PROMOTION_CODE_APPLY_FAILED'
    | 'PROMOTION_CODE_REMOVE_FAILED'
    | 'SUBSCRIPTION_UPDATE_FAILED'
    | 'SUBSCRIPTION_CANCELLATION_FAILED'
    | 'INITIAL_DATA_LOAD_FAILED'
    | 'SUBSCRIPTION_LOAD_FAILED'
    | 'INVOICE_PREVIEW_FAILED'
    | 'TOP_UP_FAILED'
    | 'AUTO_TOP_UP_SAVE_FAILED'
    | 'AUTO_TOP_UP_CANCELLATION_FAILED'
    | 'REQUEST_PARSE_FAILED'
    | 'ADYEN_SUBMIT_FAILED'
    | 'STRIPE_SUBMIT_FAILED'
    | 'STRIPE_CONFIRMATION_TOKEN_FAILED'
    | 'STRIPE_ACTION_FAILED'
    | 'STRIPE_REDIRECT_RETURN_FAILED';
