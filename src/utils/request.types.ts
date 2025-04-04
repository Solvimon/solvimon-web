export type RequestOptions = {
    enableAccessToken?: boolean;
    headers?: Record<string, string | null>;
    method?: 'GET' | 'POST'
};

export type Request = <T>(params: { endpoint: string, data?: object, options?: RequestOptions }) => Promise<T>