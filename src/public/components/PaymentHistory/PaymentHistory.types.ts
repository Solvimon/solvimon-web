import type { Customer, Invoice, Payment } from '@solvimon/types';

export interface PaymentHistoryConfiguration {
    invoiceId: Invoice['id'];
}

export interface PaymentHistoryProps {
    customer: Customer;
    paymentAttempts: Payment[];
    isLoading: boolean;
    configuration: PaymentHistoryConfiguration;
}
