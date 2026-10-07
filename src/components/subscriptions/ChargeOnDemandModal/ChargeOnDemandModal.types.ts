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
    scheduleId: PricingPlanSchedule['id'];
    items: ChargeOnDemandItem[];
    customer?: Customer;
    paymentMethods?: PaymentMethod[];
    canViewCreatedInvoice?: boolean;
}

export interface ChargeOnDemandModalEmits {
    (e: 'close'): void;
    (e: 'invoice-created', invoice: Invoice): void;
    (e: 'view-invoice', invoiceId: Invoice['id']): void;
    (e: 'payment-method-stored'): void;
    (e: 'payment-failed', error: unknown): void;
}
