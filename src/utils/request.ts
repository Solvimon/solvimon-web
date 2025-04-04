import type { ApiErrorResponse } from '@solvimon/types';
import { getDefaultHeaders, Headers } from './request.lib';
import type { Request, RequestOptions } from './request.types';

const trackSentryException = () => {};

const defaultOptions: RequestOptions = {
    method: 'GET',
    enableAccessToken: true,
};

export const request: Request = ({ endpoint: url, data = undefined, options: rawOptions }) => {
    const options = { ...defaultOptions, ...rawOptions };

    return fetch(url, {
        method: options.method,
        headers: getDefaultHeaders({
            headers: options.headers,
            enableAccessToken: options.enableAccessToken,
        }),
        credentials: 'include',
        body: data ? JSON.stringify(data) : undefined,
    })
        .then(async (response) => {
            if (!(response.headers.get('Content-Type') === 'application/json')) {
                return await response.text();
            }

            const json = await response.json().catch((error) => {
                // Log to console, to make debugging easier. Also for back-end devs
                // eslint-disable-next-line no-console
                console.error(error);
                trackSentryException();

                throw {
                    hasError: true,
                    statusCode: response.status,
                    requestId: response.headers.get(Headers.X_REQUEST_ID),
                };
            });

            if (!response.ok) {
                throw {
                    hasError: true,
                    statusCode: response.status,
                    message: json?.message,
                    requestId: response.headers.get(Headers.X_REQUEST_ID),
                    field: json?.field,
                };
            }

            return json;
        })
        .catch(async (error: ApiErrorResponse | unknown) => {
            trackSentryException();
            return Promise.reject(error);
        });
};
