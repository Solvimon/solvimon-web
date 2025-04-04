import type { ApiErrorResponse } from '@solvimon/types';
import type { GetDefaultHeaders } from './request.lib.types';
import { useAuth } from '@/components/AuthProvider';

export const Headers = {
    AUTHORIZATION: 'Authorization',
    CONTENT_TYPE: 'Content-Type',
    X_REQUEST_ID: 'X-Request-Id',
};

export const getDefaultHeaders: GetDefaultHeaders = ({
    headers: overrides = {},
    enableAccessToken,
}) => {
    const headers = {
        [Headers.CONTENT_TYPE]: 'application/json',
        ...(enableAccessToken
            ? { [Headers.AUTHORIZATION]: `Bearer ${useAuth().accessToken.value}` }
            : {}),
    };

    if (overrides) {
        Object.entries(overrides).forEach(([key, value]) => {
            if (value === null) {
                delete headers[key];
            } else {
                headers[key] = value;
            }
        });
    }

    return headers;
};

export const isApiErrorResponse = (
    error: ApiErrorResponse | unknown
): error is ApiErrorResponse => {
    return (
        !!error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string'
    );
};
