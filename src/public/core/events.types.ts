import type { Invoice, PricingPlanSubscription } from '@solvimon/solvimon-types';
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

/** The `detail` of `solvimon-payment-succeeded`: what the payment was for, as far as the element knows. */
export interface SolvimonPaymentSucceededDetail {
    /** The tag name of the element the customer paid in. */
    componentName: string;
    /** The subscription the checkout sold. */
    subscriptionId?: PricingPlanSubscription['id'];
    /** The invoice that was paid. */
    invoiceId?: Invoice['id'];
}

/**
 * The event an element dispatches once a payment went through. In the checkout, `preventDefault()`
 * keeps the customer on the page instead of sending them to the success URL set in Solvimon Desk.
 */
export type SolvimonPaymentSucceededEvent = CustomEvent<SolvimonPaymentSucceededDetail>;

/**
 * The `detail` of `solvimon-invoice-created`. The order created the invoice whether or not its
 * payment went through, so `paymentStatus` says which: `PAID` and `OVERPAID` are settled, while
 * `UNPAID`, `PARTIALLY_PAID` and a missing status are an invoice still to be paid.
 */
export interface SolvimonInvoiceCreatedDetail {
    invoiceId: Invoice['id'];
    paymentStatus: Invoice['payment_status'];
}

/** The `detail` of `solvimon-payment-method-added`. */
export interface SolvimonPaymentMethodAddedDetail {
    /** The tag name of the element the customer stored the method in. */
    componentName: string;
}

/** The `detail` of `solvimon-shipping-address-saved`. */
export interface SolvimonShippingAddressSavedDetail {
    /** The tag name of the element the customer saved the address in. */
    componentName: string;
    /**
     * The address as stored. An edit is stored as a new address that replaces the old one, so this
     * id differs from the one the form was opened with.
     */
    shippingAddressId: string;
}

/**
 * Every event an SDK element dispatches, by name. Each one bubbles and crosses the shadow root,
 * so a listener on the document or a container hears every element inside it.
 */
export interface SolvimonEventMap {
    /** The element failed and renders nothing; `detail` says what failed and where. */
    'solvimon-error': SolvimonErrorEvent;
    /** The checkout's subscription and first price have loaded. */
    'solvimon-ready': CustomEvent<undefined>;
    /** A log entry, as `onLog` receives it. */
    'solvimon-log': CustomEvent<LogEntry>;
    /** The customer asked to go somewhere the host decides on, such as an invoice. */
    'solvimon-action-request': CustomEvent<ActionRequestDetail>;
    /**
     * A payment went through: in the checkout, on pay-invoice, or in `payment-method-form` in
     * `payment` mode. The only cancelable event; see `SolvimonPaymentSucceededEvent`.
     */
    'solvimon-payment-succeeded': SolvimonPaymentSucceededEvent;
    /**
     * An on-demand order in subscription details created an invoice, while the customer still sees
     * its receipt. A failed order is not reported here but logged, as `ON_DEMAND_CHARGE_REFUSED` or,
     * when its outcome is unknown, `ON_DEMAND_CHARGE_FAILED`.
     */
    'solvimon-invoice-created': CustomEvent<SolvimonInvoiceCreatedDetail>;
    /** The customer stored a new payment method. */
    'solvimon-payment-method-added': CustomEvent<SolvimonPaymentMethodAddedDetail>;
    /** The customer added or changed a shipping address in `shipping-address-form`. */
    'solvimon-shipping-address-saved': CustomEvent<SolvimonShippingAddressSavedDetail>;
}

/**
 * Listeners for the `on` option of `createScreen` and `createComponent`, by event name. They are
 * added before the element is in the page, so they hear everything it dispatches.
 */
export type SolvimonEventListeners = {
    [K in keyof SolvimonEventMap]?: (event: SolvimonEventMap[K]) => void;
};

// Lets `addEventListener('solvimon-error', …)` on an element or the document type its event.
declare global {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface HTMLElementEventMap extends SolvimonEventMap {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface DocumentEventMap extends SolvimonEventMap {}
}
