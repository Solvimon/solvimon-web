import type { Customer } from '@solvimon/solvimon-types';
import type { ApiError } from './apiError';

export type GetDefaultHeaders = (params: {
    headers?: Record<string, string | null>;
    accessToken?: string;
}) => Record<string, string>;

export type RequestOptions = {
    headers?: Record<string, string | null>;
    method?: 'GET' | 'POST' | 'PATCH';
    /** Statuses the caller handles itself. Still rejected; only the log entry drops to `warn`. */
    expectedStatusCodes?: number[];
    /** Like `expectedStatusCodes`, for failures the status alone does not tell apart. */
    isExpectedError?: (error: ApiError) => boolean;
};

export type QueryParamValue = string | number | boolean | null | undefined | (string | number)[];

export type QueryParams = Record<string, QueryParamValue>;

/** A page of one customer's resources. */
export interface CustomerCollectionPayload {
    customerId: Customer['id'];
    pagination: {
        page?: number;
        pageSize?: number;
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
    };
    query?: Record<string, string | number | null | undefined>;
}

interface BaseRequestParams {
    url: string;
    query?: QueryParams;
    data?: object;
    options?: RequestOptions;
}

export interface SingleRequestParams extends BaseRequestParams {
    isCollection?: undefined;
}

export interface CollectionRequestParams extends BaseRequestParams {
    isCollection: true;
}

export type RequestParams = SingleRequestParams | CollectionRequestParams;
