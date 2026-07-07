import type { ApiErrorResponse } from '@solvimon/solvimon-types';

export const Headers = {
    AUTHORIZATION: 'Authorization',
    CONTENT_TYPE: 'Content-Type',
    X_REQUEST_ID: 'X-Request-Id',
    X_CLIENT_VERSION: 'X-Client-Version',
};

export const isApiErrorResponse = (
    error: ApiErrorResponse | unknown,
): error is ApiErrorResponse => {
    return (
        !!error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string'
    );
};
