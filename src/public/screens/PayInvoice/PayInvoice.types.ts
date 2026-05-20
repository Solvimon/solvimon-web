import type {
    Amount,
    Invoice,
    Payment,
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
    paymentAttempts?: Payment[];
    countryCode?: string;
    amount?: Amount;
    downloadService?: (id: Invoice['id']) => Promise<void>;
    configuration: PayInvoiceConfiguration;
}
