export interface PaymentMethodsUnavailableCardProps {
    variant: 'TOKENIZE' | 'AUTHORIZE';
    /**
     * Who the customer is paying. A legal name is the only contact detail the payload reliably
     * carries — no email, no phone — so naming them is the whole fallback, not a lead-in to a link.
     */
    sellerName?: string;
}
