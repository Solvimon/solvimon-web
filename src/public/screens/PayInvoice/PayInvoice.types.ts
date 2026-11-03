import type {
    Amount,
    Invoice,
    Payment,
    PaymentMethod,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import type { BaseScreenProps } from '@/public/screens/types';

export interface PayInvoiceConfiguration {
    /**
     * The ID of the invoice to render.
     */
    invoiceId: Invoice['id'];
    /**
     * An optional callback that is executed whenever a payment is successful.
     * It can be used to execute some follow up actions and/or to do a redirect
     * if needed.
     */
    onPaymentSuccess?: () => void;
}

export interface PayInvoiceProps extends BaseScreenProps {
    invoice?: Invoice;
    paymentMethodOptions?: PaymentMethodOptionsResponse;
    /** The customer's stored methods; those this invoice can be charged to are offered first. */
    paymentMethods?: PaymentMethod[];
    paymentAttempts?: Payment[];
    countryCode?: string;
    amount?: Amount;
    downloadService?: (invoice: Pick<Invoice, 'id' | 'invoice_number'>) => Promise<void>;
    /** Loads the invoice and its payments again, so a paid invoice reads as paid. */
    refresh?: () => Promise<unknown>;
    configuration: PayInvoiceConfiguration;
}
