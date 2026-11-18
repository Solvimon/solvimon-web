import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import PaymentAcceptorForm from './PaymentAcceptorForm.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        // The bank details are the editor's own, covered in solvimon-ui.
        BankAccountEditor: defineComponent({
            name: 'BankAccountEditorStub',
            props: { modelValue: Object, method: String, apiError: Object, disabled: Boolean },
            setup: () => () => h('div', { class: 'bank-account-editor-stub' }),
        }),
    });
});

type FormInstance = { submit: () => Promise<unknown> };

const stored = {
    id: 'paya_1',
    name: 'Main account',
    status: 'ACTIVE',
    bank_account: { type: 'IBAN', iban: 'NL91ABNA0417164300', country: 'NL' },
} as unknown as PaymentAcceptor;

describe('PaymentAcceptorForm', () => {
    it('hands back nothing while the name is missing', async () => {
        const wrapper = mount(PaymentAcceptorForm);

        const result = await (wrapper.vm as unknown as FormInstance).submit();

        expect(result).toBeUndefined();
    });

    it('hands back a new bank account once named', async () => {
        const wrapper = mount(PaymentAcceptorForm);
        await wrapper.find('input[name="payment_acceptor_name"]').setValue('Main account');

        const result = await (wrapper.vm as unknown as FormInstance).submit();

        expect(result).toMatchObject({
            method: 'CREATE',
            details: { type: 'BANK_ACCOUNT', name: 'Main account' },
        });
        expect(wrapper.findComponent({ name: 'BankAccountEditorStub' }).props('method')).toBe(
            'CREATE',
        );
    });

    it('edits a stored acceptor, handing back only what changed', async () => {
        const wrapper = mount(PaymentAcceptorForm, { props: { paymentAcceptor: stored } });
        await wrapper.find('input[name="payment_acceptor_name"]').setValue('Renamed');
        await flushPromises();

        const result = await (wrapper.vm as unknown as FormInstance).submit();

        expect(result).toEqual({
            method: 'UPDATE',
            payload: {
                type: 'BANK_ACCOUNT',
                name: 'Renamed',
                bank_account: { type: 'IBAN', country: 'NL' },
            },
        });
        expect(wrapper.findComponent({ name: 'BankAccountEditorStub' }).props('method')).toBe(
            'UPDATE',
        );
    });
});
