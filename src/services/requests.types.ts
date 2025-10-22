export type GetDefaultHeaders = (params: {
    headers?: Record<string, string | null>;
    enableAccessToken?: boolean;
}) => Record<string, string>;

export type RequestOptions = {
    headers?: Record<string, string | null>;
    method?: 'GET' | 'POST' | 'PATCH';
};

interface BaseRequestParams {
    url: string;
    query?: Record<string, string | number>;
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
