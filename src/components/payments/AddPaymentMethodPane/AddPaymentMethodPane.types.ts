import type { Customer, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';

export interface AddPaymentMethodPaneProps {
    /** Who the method is stored for. The form needs their country, name and email. */
    customer?: Customer;
    /** The ways this customer could pay, as the gateway offers them. */
    paymentMethodOptions?: PaymentMethodOptionsResponse;
    /** Set while the options are still being fetched, so the form waits rather than offering none. */
    isLoading?: boolean;
    /**
     * Whether this pane is the one on screen. Drives when the form is first built and whether a
     * request of its own counts as this pane's — a host that keeps every pane mounted has to say.
     */
    isActive?: boolean;
}

export interface AddPaymentMethodPaneEmits {
    /** The method was tokenized and stored, so the host can step back to what it was doing. */
    (e: 'success'): void;
    (e: 'failure', error: unknown): void;
}
