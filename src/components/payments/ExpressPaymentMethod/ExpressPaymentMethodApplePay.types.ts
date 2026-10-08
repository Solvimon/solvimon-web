import type { AuthorizePaymentPayload, Invoice } from '@solvimon/solvimon-types';
import type { ExpressPaymentMethodProps } from './ExpressPaymentMethod.types';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';

export interface ExpressPaymentMethodApplePayProps extends ExpressPaymentMethodProps {
    onBillingInformationChange: (state: Partial<CheckoutFormState>) => Promise<{
        trialInvoicePreview: Invoice;
        invoicePreview: Invoice;
    }>;
    context?: AuthorizePaymentPayload['context'];
    validateOnSubmit?: () => Promise<boolean>;
}
