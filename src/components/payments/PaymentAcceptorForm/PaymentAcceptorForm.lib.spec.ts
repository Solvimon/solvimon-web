import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import {
    createPaymentAcceptorFormState,
    getRefusedShownField,
    isPaymentAcceptorChosenBySubscription,
    toCreateDetails,
    toPatchPayload,
} from './PaymentAcceptorForm.lib';
import { ApiError } from '@/services/apiError';

const stored = {
    id: 'paya_1',
    name: 'Main account',
    status: 'ACTIVE',
    reference: 'ref_1',
    type: 'BANK_ACCOUNT',
    bank_account: {
        type: 'IBAN',
        iban: 'NL91ABNA0417164300',
        country: 'NL',
        bank_name: 'ABN AMRO',
        bank_address: { line1: 'Gustav Mahlerlaan 10', country: 'NL' },
    },
} as unknown as PaymentAcceptor;

describe('createPaymentAcceptorFormState', () => {
    it('starts a new acceptor empty, on IBAN', () => {
        const state = createPaymentAcceptorFormState();

        expect(state.name).toBe('');
        expect(state.bank_account.type).toBe('IBAN');
    });

    it('fills the form from a stored acceptor', () => {
        const state = createPaymentAcceptorFormState(stored);

        expect(state.name).toBe('Main account');
        expect(state.bank_account).toMatchObject({ type: 'IBAN', iban: 'NL91ABNA0417164300' });
    });
});

describe('toCreateDetails', () => {
    it('adds a bank account, without the empty fields, its address in its country', () => {
        const state = createPaymentAcceptorFormState();
        state.name = '  Main account ';
        state.bank_account.iban = 'NL91ABNA0417164300';
        state.bank_account.country = 'NL';
        state.bank_account.bank_address.line1 = 'Main street 1';

        expect(toCreateDetails(state)).toEqual({
            type: 'BANK_ACCOUNT',
            name: 'Main account',
            bank_account: {
                type: 'IBAN',
                iban: 'NL91ABNA0417164300',
                country: 'NL',
                bank_address: { line1: 'Main street 1', country: 'NL' },
            },
        });
    });

    it('leaves the form state as it was', () => {
        const state = createPaymentAcceptorFormState();
        state.bank_account.country = 'NL';

        toCreateDetails(state);

        expect(state.bank_account.bank_address.country).toBe('');
    });
});

describe('toPatchPayload', () => {
    it('updates the name without touching the bank account', () => {
        const initial = createPaymentAcceptorFormState(stored);
        const form = structuredClone(initial);
        form.name = 'Renamed';

        expect(toPatchPayload(initial, form, stored.bank_account)).toEqual({ name: 'Renamed' });
    });

    it('clears a field the customer emptied', () => {
        const initial = createPaymentAcceptorFormState(stored);
        const form = structuredClone(initial);
        form.bank_account.bank_name = '';

        expect(toPatchPayload(initial, form, stored.bank_account).bank_account).toMatchObject({
            bank_name: null,
            bank_address: stored.bank_account?.bank_address,
        });
    });

    it.each(['US_BANK_ACCOUNT', 'BIC_AND_ACCOUNT_NUMBER'] as const)(
        'preserves the stored %s type when editing bank details',
        (type) => {
            const bankAccount = { ...stored.bank_account, type };
            const initial = createPaymentAcceptorFormState({
                ...stored,
                bank_account: bankAccount,
            });
            const form = structuredClone(initial);
            form.bank_account.bank_name = 'Another bank';

            expect(toPatchPayload(initial, form, bankAccount).bank_account?.type).toBe(type);
        },
    );
});

describe('getRefusedShownField', () => {
    it('names a refused field the form shows, by its own name', () => {
        expect(
            getRefusedShownField(
                new ApiError({ statusCode: 400, field: 'bank_account.br_local.branch' }),
            ),
        ).toBe('branch');
        expect(getRefusedShownField(new ApiError({ statusCode: 400, field: 'iban' }))).toBe('iban');
    });

    it('tells a field of the bank address from the account field of the same name', () => {
        expect(
            getRefusedShownField(
                new ApiError({ statusCode: 400, field: 'bank_account.bank_address.country' }),
            ),
        ).toBeUndefined();
        expect(
            getRefusedShownField(new ApiError({ statusCode: 400, field: 'bank_account.country' })),
        ).toBe('country');
        expect(
            getRefusedShownField(
                new ApiError({ statusCode: 400, field: 'bank_account.bank_address.city' }),
            ),
        ).toBe('city');
    });

    it('names nothing for a field the form does not show, or an error that is not a refusal', () => {
        expect(
            getRefusedShownField(new ApiError({ statusCode: 400, field: 'id' })),
        ).toBeUndefined();
        expect(
            getRefusedShownField(new ApiError({ statusCode: 500, field: 'iban' })),
        ).toBeUndefined();
        expect(getRefusedShownField(new Error('down'))).toBeUndefined();
    });
});

describe('isPaymentAcceptorChosenBySubscription', () => {
    it('recognises the refusal to archive a payment acceptor a subscription is set to use', () => {
        expect(
            isPaymentAcceptorChosenBySubscription(
                new ApiError({ statusCode: 400, field: 'status' }),
            ),
        ).toBe(true);
        expect(
            isPaymentAcceptorChosenBySubscription(new ApiError({ statusCode: 400, field: 'iban' })),
        ).toBe(false);
    });
});
