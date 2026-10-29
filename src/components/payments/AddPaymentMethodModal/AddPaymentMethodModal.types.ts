import type { Customer, PricingPlanSubscription } from '@solvimon/solvimon-types';

export interface AddPaymentMethodModalProps {
    showModal: boolean;
    /** Who the method is stored for. The form needs their country, name and email. */
    customer?: Customer;
    /**
     * The subscription the method is for, when there is one. Narrows what is on offer to the ways
     * it can be paid, so the customer cannot store a method it would not accept.
     */
    subscription?: Pick<PricingPlanSubscription, 'id' | 'payment_acceptor_ids'>;
    /** What the method is for, under the title — "Add a payment method to pay for this order." */
    subTitle?: string;
}

export interface AddPaymentMethodModalEmits {
    /** The method was tokenized and stored. The host reloads its methods to pick it up. */
    (e: 'stored'): void;
    (e: 'failure', error: unknown): void;
    (e: 'close'): void;
}
