import type { ErrorCode } from '@/components/providers/LoggerProvider/LoggerProvider.types';

export function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error('Something went wrong while fetching data.');
}

/**
 * Thrown where an element cannot carry on and the failure has a code of its own. The error
 * boundary reports it once, under that code, instead of as `UNHANDLED_ERROR`.
 */
export class CodedError extends Error {
    readonly code: ErrorCode;

    constructor(code: ErrorCode, message: string) {
        super(message);
        this.name = 'CodedError';
        this.code = code;
    }
}
