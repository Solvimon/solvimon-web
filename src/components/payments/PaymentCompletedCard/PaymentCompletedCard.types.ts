import type { Amount } from '@solvimon/solvimon-types';

export interface PaymentCompletedCardProps {
    amount?: Amount;
    variant: 'TOKENIZE' | 'AUTHORIZE';
}
