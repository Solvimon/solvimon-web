type ErrorCode =
    | 'UNKNOWN_ERROR'
    | 'AUTHORIZATION_FAILED'
    | 'PAYMENT_DETAILS_CALL_FAILED'
    | 'PAYMENT_METHOD_STORAGE_FAILED'
    | 'REDIRECT_RESULT_PAYMENT_ACCEPTOR_MISSING'
    | 'TOKENIZE_FAILED'
    | 'RESOURCE_REVOKED'
    | 'PAYMENT_INTEGRATION_INITIALIZATION_FAILED';

export interface Error {
    code: ErrorCode;
    message: string;
    error?: unknown;
    /**
     * The reference for this visit, shown to the customer so they can quote it when they report
     * the failure. The same value is on every `LogEntry` the session emitted.
     */
    reference?: string;
}
