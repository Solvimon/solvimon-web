export type GetDefaultHeaders = (params: {
    headers?: Record<string, string | null>;
    enableAccessToken?: boolean;
}) => Record<string, string>;

export type RequestOptions = {
    headers?: Record<string, string | null>;
    method?: 'GET' | 'POST' | 'PATCH';
};

export type QueryParamValue = string | number | boolean | null | undefined | (string | number)[];

export type QueryParams = Record<string, QueryParamValue>;

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
