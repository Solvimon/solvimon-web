import type { ActionRequestDetail } from './action-request.types';
import type { SolvimonErrorDetail } from '@/components/providers/ErrorBoundary/ErrorBoundary.types';
import type { LogEntry } from '@/components/providers/LoggerProvider/LoggerProvider.types';

/**
 * Every event an SDK element dispatches, by name. Each one bubbles and crosses the shadow root,
 * so a listener on the document or a container hears every element inside it.
 */
export interface SolvimonEventMap {
    /** The element failed and renders nothing; `detail` says what failed and where. */
    'solvimon-error': CustomEvent<SolvimonErrorDetail>;
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
