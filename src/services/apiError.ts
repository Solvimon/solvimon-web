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
    /**
     * The API's own error code, such as `PORTAL_URL_EXPIRED`. Not `code`: payment handlers read
     * that as the SDK's code for a failed payment.
     */
    readonly errorCode?: string;
    /** The status of the checkout session a closed portal link belongs to. */
    readonly checkoutSessionStatus?: string;

    constructor({
        statusCode,
        message,
        requestId,
        field,
        resourceType,
        resourceId,
        errorCode,
        checkoutSessionStatus,
    }: {
        statusCode: number;
        message?: string;
        requestId?: string | null;
        field?: string;
        resourceType?: string;
        resourceId?: string;
        errorCode?: string;
        checkoutSessionStatus?: string;
    }) {
        super(message || `Request failed with status ${statusCode}`);

        this.name = 'ApiError';
        this.statusCode = statusCode;
        if (requestId) this.requestId = requestId;
        if (field) this.field = field;
        if (resourceType) this.resourceType = resourceType;
        if (resourceId) this.resourceId = resourceId;
        if (errorCode) this.errorCode = errorCode;
        if (checkoutSessionStatus) this.checkoutSessionStatus = checkoutSessionStatus;
    }
}

export function isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
}

/**
 * The API turned down the promotion code the customer typed: one it does not know, or one it knows
 * but will not apply. A customer's mistake, not a failure of the SDK.
 */
export function isRejectedPromotionCode(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    if ('field' in error && error.field === 'promotion_codes') return true;

    return isApiError(error) && error.statusCode === 404 && error.resourceType === 'PROMOTION_CODE';
}
