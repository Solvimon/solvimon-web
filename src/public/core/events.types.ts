import type { ActionRequestDetail } from './action-request.types';
import type {
    ErrorCode,
    LogEntry,
} from '@/components/providers/LoggerProvider/LoggerProvider.types';

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

/** The event an element dispatches when it fails and cannot carry on. */
export type SolvimonErrorEvent = CustomEvent<SolvimonErrorDetail>;

/**
 * Every event an SDK element dispatches, by name. Each one bubbles and crosses the shadow root,
 * so a listener on the document or a container hears every element inside it.
 */
export interface SolvimonEventMap {
    /** The element failed and renders nothing; `detail` says what failed and where. */
    'solvimon-error': SolvimonErrorEvent;
    /** The checkout is ready and the customer can pay. */
    'solvimon-ready': CustomEvent<undefined>;
    /** A log entry, as `onLog` receives it. */
    'solvimon-log': CustomEvent<LogEntry>;
    /** The customer asked to go somewhere the host decides on, such as an invoice. */
    'solvimon-action-request': CustomEvent<ActionRequestDetail>;
}

// Lets `addEventListener('solvimon-error', …)` on an element or the document type its event.
declare global {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface HTMLElementEventMap extends SolvimonEventMap {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface DocumentEventMap extends SolvimonEventMap {}
}
