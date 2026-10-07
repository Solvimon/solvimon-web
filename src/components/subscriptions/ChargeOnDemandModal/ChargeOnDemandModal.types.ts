import type {
    Customer,
    Invoice,
    PaymentMethod,
    PricingPlanSchedule,
} from '@solvimon/solvimon-types';
import type { ChargeOnDemandItem } from '@solvimon/solvimon-ui';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

export const CHARGE_ON_DEMAND_MODAL_STEPS = [
    'ORDER',
    'ADD_PAYMENT_METHOD',
    'PLACED',
    'PAYMENT_FAILED',
    'FAILED',
] as const;

export type ChargeOnDemandModalStep = (typeof CHARGE_ON_DEMAND_MODAL_STEPS)[number];

export interface ChargeOnDemandModalProps {
    showModal: boolean;
    subscription: PricingPlanSubscriptionExpanded;
    /** The schedule the items are charged on: the one the subscription is billed on now. */
    scheduleId: PricingPlanSchedule['id'];
    items: ChargeOnDemandItem[];
    customer?: Customer;
    /** All of the customer's saved payment methods; the modal offers the ones that can pay. */
    paymentMethods?: PaymentMethod[];
    /** Offers "Go to invoice" on the receipt, for a host that handles `view-invoice`. */
    canViewCreatedInvoice?: boolean;
}

export interface ChargeOnDemandModalEmits {
    (e: 'close'): void;
    /** The order placed an invoice, paid or not. Reported as soon as the charge returns it. */
    (e: 'invoice-created', invoice: Invoice): void;
    /** The customer left the receipt of a paid order. */
    (e: 'order-paid'): void;
    /** The customer asked to see the invoice of the order they just placed. Follows `close`. */
    (e: 'view-invoice', invoiceId: Invoice['id']): void;
    (e: 'payment-method-stored'): void;
    (e: 'payment-failed', error: unknown): void;
}
