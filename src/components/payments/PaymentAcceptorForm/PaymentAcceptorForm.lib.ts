import type { PaymentAcceptor, PaymentAcceptorPatchPayload } from '@solvimon/solvimon-types';
import {
    cleanBankAccountVariant,
    createBankAccountFormState,
    objectDiff,
    toBankAccountCreatePayload,
} from '@solvimon/solvimon-ui';
import type { PaymentAcceptorFormState } from './PaymentAcceptorForm.types';
import type { PaymentAcceptorCreateDetails } from '@/composables/usePaymentAcceptors';

/** The form filled from an acceptor, or empty, starting on IBAN, for a new one. */
export const createPaymentAcceptorFormState = (
    paymentAcceptor?: PaymentAcceptor,
): PaymentAcceptorFormState => ({
    name: paymentAcceptor?.name ?? '',
    bank_account: createBankAccountFormState(
        paymentAcceptor?.bank_account?.type ?? 'IBAN',
        paymentAcceptor?.bank_account,
    ),
});

/** A new bank account acceptor. The portal only lets a customer add bank accounts. */
export const toCreateDetails = (form: PaymentAcceptorFormState): PaymentAcceptorCreateDetails => ({
    type: 'BANK_ACCOUNT',
    name: form.name.trim(),
    bank_account: toBankAccountCreatePayload(structuredClone(form.bank_account)),
});

/**
 * What changed since the form was filled. A cleared field is sent as null so the API clears it too.
 * The bank account always carries its type and country, which the API needs to read the rest.
 */
export const toPatchPayload = (
    initial: PaymentAcceptorFormState,
    form: PaymentAcceptorFormState,
): PaymentAcceptorPatchPayload => {
    const changes = objectDiff<PaymentAcceptorFormState>({
        from: initial,
        to: form,
        mode: 'deep',
        nullifyEmptyValues: true,
    });

    const changedBankAccount: NonNullable<PaymentAcceptorPatchPayload['bank_account']> = {
        ...changes.bank_account,
        type: form.bank_account.type,
        country: form.bank_account.country,
    };
    const bankAccount = cleanBankAccountVariant(changedBankAccount);

    if (bankAccount?.bank_address && bankAccount.country) {
        bankAccount.bank_address.country = bankAccount.country;
    }

    return {
        type: 'BANK_ACCOUNT',
        ...(changes.name !== undefined && { name: form.name.trim() }),
        bank_account: bankAccount,
    };
};
