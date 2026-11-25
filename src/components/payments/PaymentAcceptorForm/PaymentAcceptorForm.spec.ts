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
    const scrollIntoView = vi.fn();

    // jsdom has no scrollIntoView, which the form calls on the first refused field.
    beforeEach(() => {
        scrollIntoView.mockClear();
        Element.prototype.scrollIntoView = scrollIntoView;
    });

    afterEach(() => {
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    });

    it('hands back nothing while the name is missing', async () => {
        const wrapper = mount(PaymentAcceptorForm);

        const result = await (wrapper.vm as unknown as FormInstance).submit();

        expect(result).toBeUndefined();
    });

    it('brings the first refused field into view', async () => {
        const wrapper = mount(PaymentAcceptorForm, {
            global: {
                stubs: {
                    BankAccountEditorStub: {
                        template: '<p class="text-feedback-danger">Required</p>',
                    },
                },
            },
        });

        await (wrapper.vm as unknown as FormInstance).submit();

        expect(scrollIntoView).toHaveBeenCalledOnce();
    });

    it('gives the editor the fields of a bank account type it switches to', async () => {
        const wrapper = mount(PaymentAcceptorForm);
        const editor = wrapper.findComponent({ name: 'BankAccountEditorStub' });
        const ibanAccount = editor.props('modelValue') as Record<string, unknown>;

        editor.vm.$emit('update:modelValue', {
            ...ibanAccount,
            bank_name: 'Banco',
            type: 'ACCOUNT_NUMBER_AND_BIC',
        });
        await wrapper.vm.$nextTick();

        expect(editor.props('modelValue')).toMatchObject({
            type: 'ACCOUNT_NUMBER_AND_BIC',
            bank_name: 'Banco',
            account_number_and_bic: { account_number: '', bic: '', bank_code: '' },
        });
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
