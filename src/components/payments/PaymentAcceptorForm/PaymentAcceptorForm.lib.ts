import type { PaymentAcceptor, PaymentAcceptorPatchPayload } from '@solvimon/solvimon-types';
import {
    cleanBankAccountVariant,
    createBankAccountFormState,
    objectDiff,
    toBankAccountCreatePayload,
} from '@solvimon/solvimon-ui';
import type { PaymentAcceptorFormState } from './PaymentAcceptorForm.types';
import type { PaymentAcceptorCreateDetails } from '@/composables/usePaymentAcceptors';
import { isApiError } from '@/services/apiError';

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

/** Deletes the fields left empty, in the given object and in its nested parts. */
const deleteEmptyFields = (value: object): void => {
    for (const [key, item] of Object.entries(value)) {
        if (item === '' || item === undefined) {
            Reflect.deleteProperty(value, key);
        } else if (item !== null && typeof item === 'object') {
            deleteEmptyFields(item);
        }
    }
};

/** A new bank account acceptor. The portal only lets a customer add bank accounts. */
export const toCreateDetails = (form: PaymentAcceptorFormState): PaymentAcceptorCreateDetails => {
    const bankAccount = toBankAccountCreatePayload(structuredClone(form.bank_account));

    if (bankAccount) {
        deleteEmptyFields(bankAccount);
    }

    return { type: 'BANK_ACCOUNT', name: form.name.trim(), bank_account: bankAccount };
};

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

/**
 * The fields the form shows, by the name the API reports a refused field under: the property name
 * alone, such as `branch` for `bank_account.br_local.branch`.
 */
const SHOWN_FIELDS = new Set([
    'name',
    'country',
    'bank_name',
    'iban',
    'bic',
    'account_number',
    'bank_code',
    'routing_number',
    'account_type',
    'sort_code',
    'branch',
    'cbu',
    'clabe',
    'line1',
    'line2',
    'postal_code',
    'city',
    'state',
]);

/**
 * The field a refused save names, when it is one the form shows. A field the form does not show
 * would put the message where the customer cannot see it, so that is left to a general message.
 */
export const getRefusedShownField = (error: unknown): string | undefined => {
    if (!isApiError(error) || error.statusCode !== 400 || !error.field) return undefined;

    const fieldName = error.field.split('.').pop() ?? error.field;
    return SHOWN_FIELDS.has(fieldName) ? fieldName : undefined;
};

/**
 * The API refuses to archive an acceptor that an active or paused subscription is set to use,
 * naming the `status` it was asked to change.
 */
export const isPaymentAcceptorChosenBySubscription = (error: unknown): boolean =>
    isApiError(error) && error.statusCode === 400 && error.field === 'status';
