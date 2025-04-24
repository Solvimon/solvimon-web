export interface InvoiceDetailProps {
    /**
     * The ID of the invoice to be displayed
     */
    invoiceId: string;
    /**
     * Whether to show the customer billing information.
     * @default: true
     */
    showCustomerBillingInformation?: boolean;
}
