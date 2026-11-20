import type { PaymentAcceptor } from '@solvimon/solvimon-types';

export interface PaymentAcceptorFormConfiguration {
    /** The bank account to edit. Left out, the form adds a new one. */
    paymentAcceptorId?: PaymentAcceptor['id'];
}
