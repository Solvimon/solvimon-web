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
 * A bank-account PATCH needs its stored type and country. The endpoint clears an omitted address
 * within a bank-account PATCH, so carry the existing address when changing other bank fields.
 */
export const toPatchPayload = (
    initial: PaymentAcceptorFormState,
    form: PaymentAcceptorFormState,
    storedBankAccount: PaymentAcceptor['bank_account'],
): PaymentAcceptorPatchPayload => {
    const changes = objectDiff<PaymentAcceptorFormState>({
        from: initial,
        to: form,
        mode: 'deep',
        nullifyEmptyValues: true,
    });

    const bankAccountChanges = changes.bank_account;
    const storedAddress = storedBankAccount?.bank_address;
    const addressChanges = bankAccountChanges?.bank_address;
    const bankAccount =
        bankAccountChanges &&
        cleanBankAccountVariant({
            ...bankAccountChanges,
            type: storedBankAccount?.type ?? form.bank_account.type,
            country: form.bank_account.country,
            ...((storedAddress || addressChanges) && {
                bank_address: {
                    ...storedAddress,
                    ...addressChanges,
                    country:
                        bankAccountChanges.country ??
                        storedAddress?.country ??
                        form.bank_account.country,
                },
            }),
        });

    return {
        ...(changes.name !== undefined && { name: form.name.trim() }),
        ...(bankAccount && { type: 'BANK_ACCOUNT', bank_account: bankAccount }),
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

/** The fields of the bank's address. The form shows no country for it, only the account's own. */
const ADDRESS_FIELDS = new Set(['line1', 'line2', 'postal_code', 'city', 'state']);

/**
 * The field a refused save names, when it is one the form shows. A field the form does not show
 * would put the message where the customer cannot see it, so that is left to a general message.
 */
export const getRefusedShownField = (error: unknown): string | undefined => {
    if (!isApiError(error) || error.statusCode !== 400 || !error.field) return undefined;

    const path = error.field.split('.');
    const fieldName = path.pop() ?? error.field;
    // Names repeat between the account and its bank's address, so the path must agree with which.
    if (path.includes('bank_address') !== ADDRESS_FIELDS.has(fieldName)) return undefined;
    return SHOWN_FIELDS.has(fieldName) ? fieldName : undefined;
};

/**
 * The API refuses to archive an acceptor that an active or paused subscription is set to use,
 * naming the `status` it was asked to change.
 */
export const isPaymentAcceptorChosenBySubscription = (error: unknown): boolean =>
    isApiError(error) && error.statusCode === 400 && error.field === 'status';
