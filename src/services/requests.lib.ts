import type { ApiErrorResponse } from '@solvimon/solvimon-types';
import type { QueryParams } from './requests.types';

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

/** Nulls and undefineds are left out entirely; arrays go out as repeated `key[]` entries. */
export const appendQueryParams = (url: URL, query: QueryParams = {}): void => {
    Object.entries(query).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((entry) => url.searchParams.append(`${key}[]`, `${entry}`));
            return;
        }

        url.searchParams.append(key, `${value}`);
    });
};
