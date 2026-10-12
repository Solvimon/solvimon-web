import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { ErrorHandlingProvider } from '@solvimon/solvimon-ui';
import PaymentMethodsManagement from './PaymentMethodsManagement.vue';
import TranslationProvider from '@/components/providers/TranslationProvider/TranslationProvider.vue';
import PayButton from '@/components/payments/PayButton/PayButton.vue';

// The global setup swaps `useIntl` for a stub that only reads default messages; these specs need
// the real one, so that a locale and a host override are what is rendered.
vi.mock('@solvimon/solvimon-ui', async () => vi.importActual('@solvimon/solvimon-ui'));

vi.mock('@/components/providers/LoggerProvider/composables/useLogger', () => ({
    useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

const inLocale = async (
    component: unknown,
    props: Record<string, unknown>,
    locale: string,
    messages?: Record<string, string>,
) => {
    const wrapper = mount(
        defineComponent({
            render: () =>
                h(ErrorHandlingProvider, { onError: vi.fn() }, () =>
                    h(TranslationProvider, { locale, messages }, () =>
                        h(component as never, props as never),
                    ),
                ),
        }),
        {
            global: {
                stubs: { PaymentMethodsList: true, PaymentMethodForm: true, ScreenTitle: true },
            },
        },
    );
    await flushPromises();
    await vi.dynamicImportSettled();
    await flushPromises();
    return wrapper;
};

const EXPECTED: Record<string, { list: string; add: string; card: string }> = {
    'en-US': { list: 'Your payment methods', add: 'Add payment method', card: 'Credit Card' },
    'nl-NL': { list: 'Jouw betaalmethoden', add: 'Betaalmethode toevoegen', card: 'creditcard' },
    'de-DE': {
        list: 'Ihre Zahlungsmethoden',
        add: 'Zahlungsmethode hinzufügen',
        card: 'Kreditkarte',
    },
    'it-IT': {
        list: 'I tuoi metodi di pagamento',
        add: 'Aggiungi metodo di pagamento',
        card: 'carta di credito',
    },
};

describe('DD-3553 translated strings', () => {
    it.each(Object.keys(EXPECTED))('renders the payment methods screen in %s', async (locale) => {
        const wrapper = await inLocale(PaymentMethodsManagement, { paymentMethods: [] }, locale);

        expect(wrapper.text()).toContain(EXPECTED[locale].list);
        expect(wrapper.text()).toContain(EXPECTED[locale].add);
    });

    it.each(Object.keys(EXPECTED))(
        'names card payments on the pay button in %s',
        async (locale) => {
            const wrapper = await inLocale(
                PayButton,
                {
                    amount: { currency: 'EUR', quantity: '10.00' },
                    paymentMethod: { paymentMethodType: 'scheme' },
                },
                locale,
            );

            expect(wrapper.text()).toContain(EXPECTED[locale].card);
        },
    );

    it('lets a host messages override replace each new string', async () => {
        const messages = {
            'screens.payment_method_management.list_title': 'HOST LIST',
            'screens.payment_method_management.add_button': 'HOST ADD',
            'screens.payment_method_management.cancel_button': 'HOST CANCEL',
            'pay_button.payment_method.card': 'HOST CARD',
        };

        const screen = await inLocale(
            PaymentMethodsManagement,
            { paymentMethods: [] },
            'nl-NL',
            messages,
        );
        expect(screen.text()).toContain('HOST LIST');
        expect(screen.text()).toContain('HOST ADD');

        await screen.find('button').trigger('click');
        await flushPromises();
        expect(screen.text()).toContain('HOST CANCEL');

        const button = await inLocale(
            PayButton,
            {
                amount: { currency: 'EUR', quantity: '10.00' },
                paymentMethod: { paymentMethodType: 'scheme' },
            },
            'nl-NL',
            messages,
        );
        expect(button.text()).toContain('HOST CARD');
    });
});
