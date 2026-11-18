import type {
    FormFieldError,
    PaymentAcceptor,
    PaymentAcceptorPatchPayload,
} from '@solvimon/solvimon-types';
import type { BankAccountEditorFormState } from '@solvimon/solvimon-ui';
import type { PaymentAcceptorCreateDetails } from '@/composables/usePaymentAcceptors';

export interface PaymentAcceptorFormProps {
    /** The acceptor being edited; without one the form adds a new bank account. */
    paymentAcceptor?: PaymentAcceptor;
    disabled?: boolean;
    /** What the API refused, by field. */
    apiError?: FormFieldError;
}

export interface PaymentAcceptorFormState {
    name: string;
    bank_account: BankAccountEditorFormState;
}

/** What a filled-in form stores: a new acceptor, or the changes to the one being edited. */
export type PaymentAcceptorFormResult =
    | { method: 'CREATE'; details: PaymentAcceptorCreateDetails }
    | { method: 'UPDATE'; payload: PaymentAcceptorPatchPayload };
