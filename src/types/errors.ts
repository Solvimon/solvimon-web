type ErrorCode =
    | 'UNKNOWN_ERROR'
    | 'AUTHORIZATION_FAILED'
    | 'PAYMENT_DETAILS_CALL_FAILED'
    | 'PAYMENT_METHOD_STORAGE_FAILED'
    | 'REDIRECT_RESULT_PAYMENT_ACCEPTOR_MISSING'
    | 'TOKENIZE_FAILED'
    | 'PAYMENT_INTEGRATION_INITIALIZATION_FAILED';

export interface Error {
    code: ErrorCode;
    message: string;
    error?: unknown;
}
