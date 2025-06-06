import type { Amount } from '@solvimon/types';

export interface PaymentCompletedCardProps {
    amount?: Amount;
    variant: 'TOKENIZE' | 'AUTHORIZE';
}
