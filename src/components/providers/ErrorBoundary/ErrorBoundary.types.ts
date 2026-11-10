import type { ErrorCode } from '@/components/providers/LoggerProvider/LoggerProvider.types';

/**
 * The `detail` of the `solvimon-error` event: the same facts as the `log` entry the failure is
 * logged under, so a listener on a container can tell which element failed.
 */
export interface SolvimonErrorDetail {
    error: Error;
    /** The error's own code, or `UNHANDLED_ERROR` for an error without one. */
    code: ErrorCode;
    /** The tag name of the element that failed. */
    componentName: string;
    /** The session reference, which support can find the failure by. */
    reference: string;
}

/**
 * The event an element dispatches when it fails and cannot carry on. Like every SDK event it
 * bubbles and crosses the shadow root.
 */
export type SolvimonErrorEvent = CustomEvent<SolvimonErrorDetail>;
