export function uniqueId(prefix = ''): string {
    return `${prefix}${crypto.randomUUID()}`;
}
