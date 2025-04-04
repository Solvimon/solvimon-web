export type GetDefaultHeaders = (params: {
    headers?: Record<string, string | null>;
    enableAccessToken?: boolean;
}) => Record<string, string>;
