import type { Invoice } from '@solvimon/solvimon-types';
import type { ExpressPaymentMethodProps } from './ExpressPaymentMethod.types';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import type { PaymentAuthorizationContext } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

export interface ExpressPaymentMethodApplePayProps extends ExpressPaymentMethodProps {
    onBillingInformationChange: (state: Partial<CheckoutFormState>) => Promise<{
        trialInvoicePreview: Invoice;
        invoicePreview: Invoice;
    }>;
    context?: PaymentAuthorizationContext;
    validateOnSubmit?: () => Promise<boolean>;
}
