import type { Amount } from '@solvimon/solvimon-types';

export interface PaymentCompletedCardProps {
    amount?: Amount;
    variant: 'TOKENIZE' | 'AUTHORIZE';
    /**
     * Whether the page navigates away now that the payment is through, which is the only thing
     * that makes the redirect notice true. Off by default: most flows end on this card and stay
     * put, and a customer told to expect a redirect that never comes waits for nothing.
     */
    redirecting?: boolean;
}
