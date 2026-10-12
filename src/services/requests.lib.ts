import type { QueryParams } from './requests.types';

export const Headers = {
    AUTHORIZATION: 'Authorization',
    CONTENT_TYPE: 'Content-Type',
    X_REQUEST_ID: 'X-Request-Id',
    X_CLIENT_VERSION: 'X-Client-Version',
};

export const MediaType = {
    JSON: 'application/json',
    PDF: 'application/pdf',
};

/**
 * The bare media type of a `Content-Type` header, without its parameters and lowercased.
 * `application/json; charset=utf-8` is as ordinary as a bare `application/json` and has to route
 * the same way, and the header is case-insensitive.
 */
export const getMediaType = (contentType: string | null | undefined): string =>
    (contentType ?? '').split(';')[0].trim().toLowerCase();

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

/**
 * `base` with each segment appended as exactly one path segment, so an id can never add a segment,
 * a query or a fragment of its own. `.` and `..` would still step up the path however they are
 * encoded, and an empty segment names the collection, so those throw.
 */
export const buildUrl = (base: string, ...segments: string[]): string => {
    const url = new URL(base);
    const encoded = segments.map((segment) => {
        if (typeof segment !== 'string' || segment === '' || segment === '.' || segment === '..') {
            throw new Error('Invalid URL path segment');
        }
        return encodeURIComponent(segment);
    });
    url.pathname = [url.pathname.replace(/\/+$/, ''), ...encoded].join('/');
    return url.toString();
};
