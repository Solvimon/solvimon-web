import { preloadPaymentIntegrationForms } from './preloadPaymentIntegrationForms';
import { createPaymentMethodOptionEntry } from '@/test-utils/paymentMethodOptionsFixture';

const { mockLoadAdyenSdk, loaded } = vi.hoisted(() => ({
    mockLoadAdyenSdk: vi.fn(),
    loaded: [] as string[],
}));

vi.mock('@/utils/adyenSdk', () => ({ loadAdyenSdk: mockLoadAdyenSdk }));
vi.mock('@adyen/adyen-web/styles/adyen.css?inline', () => {
    loaded.push('adyen-css');
    return { default: '' };
});
vi.mock('@/components/payments/PaymentIntegrationFormAdyen/PaymentIntegrationFormAdyen.vue', () => {
    loaded.push('adyen-form');
    return { default: {} };
});
vi.mock(
    '@/components/payments/PaymentIntegrationFormStripe/PaymentIntegrationFormStripe.vue',
    () => {
        loaded.push('stripe-form');
        return { default: {} };
    },
);

describe('preloadPaymentIntegrationForms', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoadAdyenSdk.mockResolvedValue({});
    });

    it('loads only what the gateways on offer need', async () => {
        await preloadPaymentIntegrationForms([
            createPaymentMethodOptionEntry({ gateway: 'STRIPE' }),
        ]);

        expect(loaded).toEqual(['stripe-form']);
        expect(mockLoadAdyenSdk).not.toHaveBeenCalled();

        await preloadPaymentIntegrationForms([
            createPaymentMethodOptionEntry({ gateway: 'ADYEN' }),
        ]);

        expect(loaded).toEqual(expect.arrayContaining(['adyen-form', 'adyen-css']));
        expect(mockLoadAdyenSdk).toHaveBeenCalledOnce();
    });

    it('settles when a load fails, leaving the failure to the form', async () => {
        mockLoadAdyenSdk.mockRejectedValue(new Error('offline'));

        await expect(
            preloadPaymentIntegrationForms([createPaymentMethodOptionEntry({ gateway: 'ADYEN' })]),
        ).resolves.toBeUndefined();
    });
});
