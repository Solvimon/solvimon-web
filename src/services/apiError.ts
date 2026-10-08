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
    /** The kind of resource the error is about, such as `PAYMENT` on a refused payment. */
    readonly resourceType?: string;
    readonly resourceId?: string;

    constructor({
        statusCode,
        message,
        requestId,
        field,
        resourceType,
        resourceId,
    }: {
        statusCode: number;
        message?: string;
        requestId?: string | null;
        field?: string;
        resourceType?: string;
        resourceId?: string;
    }) {
        super(message || `Request failed with status ${statusCode}`);

        this.name = 'ApiError';
        this.statusCode = statusCode;
        if (requestId) this.requestId = requestId;
        if (field) this.field = field;
        if (resourceType) this.resourceType = resourceType;
        if (resourceId) this.resourceId = resourceId;
    }
}

export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}
