export function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error('Something went wrong while fetching data.');
}
