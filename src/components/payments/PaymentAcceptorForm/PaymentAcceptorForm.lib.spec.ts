import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import {
    createPaymentAcceptorFormState,
    toCreateDetails,
    toPatchPayload,
} from './PaymentAcceptorForm.lib';

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
    it('sends a changed name, with the type and country the API needs', () => {
        const initial = createPaymentAcceptorFormState(stored);
        const form = structuredClone(initial);
        form.name = 'Renamed';

        expect(toPatchPayload(initial, form)).toEqual({
            type: 'BANK_ACCOUNT',
            name: 'Renamed',
            bank_account: { type: 'IBAN', country: 'NL' },
        });
    });

    it('clears a field the customer emptied', () => {
        const initial = createPaymentAcceptorFormState(stored);
        const form = structuredClone(initial);
        form.bank_account.bank_name = '';

        expect(toPatchPayload(initial, form).bank_account).toMatchObject({ bank_name: null });
    });
});
