import { useAuth } from '../components/AuthProvider';
import { getDefaultHeaders, Headers, isApiErrorResponse } from './request.lib';
import { ApiErrorResponse, Environment } from '@solvimon/types';

type Options = {
    enableAccessToken?: boolean;
    headers?: Record<string, string | null>;
    method?: 'GET' | 'POST'
};

const trackSentryException = (...args) => {}

const defaultOptions: Options = {
    method: 'GET',
    enableAccessToken: true
}

export const request = async (url: string, data: object = undefined, rawOptions: Options) => {
    const options = { ...defaultOptions, ...rawOptions };
    
    return fetch(url, {
        method: options.method,
        headers: getDefaultHeaders({ headers: options.headers, enableAccessToken: options.enableAccessToken }),
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
                trackSentryException(error, { Message: 'Failed parsing JSON from api' });

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
            trackSentryException(
                isApiErrorResponse(error)
                    ? new Error(`POST: ${url} - ${error.message}`)
                    : new Error(`POST: ${url}`),
                {
                    Payload: data,
                    Error: error,
                    ...getErrorTrackingParams(error),
                }
            );

            // await handleError(
            //     {
            //         message: isApiErrorResponse(error) ? error.message : '',
            //         statusCode: isApiErrorResponse(error) ? error.statusCode : undefined,
            //         requestId: isApiErrorResponse(error) ? error.requestId : undefined,
            //     },
            //     {
            //         showToastOnError: mergedOptions.notificationOnError ?? false,
            //         logoutOnUnauthorized: mergedOptions.logoutOnUnauthorized ?? true,
            //     }
            // );

            return Promise.reject(error);
        });

    // if (!mergedOptions.disableAccessCheck) {
    //     if (await hasAccessToken()) {
    //         return executeRequest();
    //     }
    //     void router.push({ name: 'login' });
    //     return;
    // }

};

function getErrorTrackingParams(error: unknown): any {
    throw new Error('Function not implemented.');
}

