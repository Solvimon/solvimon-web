import type { Invoice } from '@solvimon/types';
import type { ExpressPaymentMethodProps } from './ExpressPaymentMethod.types';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';

export interface ExpressPaymentMethodApplePayProps extends ExpressPaymentMethodProps {
    onBillingInformationChange: (state: Partial<CheckoutFormState>) => Promise<{
        trialInvoicePreview: Invoice;
        invoicePreview: Invoice;
    }>;
}
