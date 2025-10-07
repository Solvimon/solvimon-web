import type { Customer, Payment } from '@solvimon/types';
import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonPaymentHistoryProps extends EntryBaseProps {
    invoiceId: string;
    paymentAttempts: Payment[];
    customer: Customer;
}

export interface SolvimonPaymentHistoryEmits extends EntryBaseEmits {}
