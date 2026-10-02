/**
 * A failed API call. An `Error` rather than an object literal so a host's reporter has a name, a
 * message and a stack to group by.
 */
export class ApiError extends Error {
    /** Callers recognise a rejection by this. */
    readonly hasError = true;
    readonly statusCode: number;
    readonly requestId?: string;
    readonly field?: string;

    constructor({
        statusCode,
        message,
        requestId,
        field,
    }: {
        statusCode: number;
        message?: string;
        requestId?: string | null;
        field?: string;
    }) {
        super(message || `Request failed with status ${statusCode}`);

        this.name = 'ApiError';
        this.statusCode = statusCode;
        if (requestId) this.requestId = requestId;
        if (field) this.field = field;
    }
}

export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}
