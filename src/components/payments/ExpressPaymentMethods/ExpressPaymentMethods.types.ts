import type { Address, Amount, Invoice, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import type { ExpressPaymentMethodProps } from '@/components/payments/ExpressPaymentMethod/ExpressPaymentMethod.types';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';

export interface ExpressPaymentMethodsProps {
    amount: Amount;
    countryCode: string;
    locale: string;
    /**
     * Express payment methods. The `undefined` value will show a loading state.
     * The `null` value will show an empty state.
     */
    paymentMethodsOptionsResponse: PaymentMethodOptionsResponse | undefined;
    billingInformation: ExpressPaymentMethodProps['billingInformation'];
    onBillingInformationChange: (state: Partial<CheckoutFormState>) => Promise<{
        trialInvoicePreview: Invoice;
        invoicePreview: Invoice;
    }>;
}

export interface ExpressPaymentMethodsEmits {
    (e: 'update-billing-information', billingInformation: Partial<Address>): void;
}
