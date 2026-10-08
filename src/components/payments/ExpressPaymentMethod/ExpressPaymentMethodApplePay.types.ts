import type { AuthorizePaymentPayload, Invoice } from '@solvimon/solvimon-types';
import type { ExpressPaymentMethodProps } from './ExpressPaymentMethod.types';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';

export interface ExpressPaymentMethodApplePayProps extends ExpressPaymentMethodProps {
    onBillingInformationChange: (state: Partial<CheckoutFormState>) => Promise<{
        trialInvoicePreview: Invoice;
        invoicePreview: Invoice;
    }>;
    /**
     * What the payment is for. Without it the charge creates no subscription, and the customer is
     * billed for nothing.
     */
    context?: AuthorizePaymentPayload['context'];
    /** Checked before the sheet's authorization is allowed to become a charge. */
    validateOnSubmit?: () => Promise<boolean>;
}
