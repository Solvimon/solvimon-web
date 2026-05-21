const UNDEFINED_SENTINEL = '\x00undefined';

function replacer(_key: string, value: unknown): unknown {
    return value === undefined ? UNDEFINED_SENTINEL : value;
}

export function isEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a, replacer) === JSON.stringify(b, replacer);
}

export function isEmpty(value: unknown): boolean {
    if (value == null) return true;
    if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
    if (value instanceof Map || value instanceof Set) return value.size === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return true;
}
