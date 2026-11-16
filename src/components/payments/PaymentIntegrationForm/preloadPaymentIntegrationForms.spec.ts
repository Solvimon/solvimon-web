import { preloadPaymentIntegrationForms } from './preloadPaymentIntegrationForms';
import { createPaymentMethodOptionEntry } from '@/test-utils/paymentMethodOptionsFixture';

const { mockLoadAdyen, mockLoadAdyenForm, mockLoadStripeForm } = vi.hoisted(() => ({
    mockLoadAdyen: vi.fn(),
    mockLoadAdyenForm: vi.fn(),
    mockLoadStripeForm: vi.fn(),
}));

vi.mock('@/utils/adyenSdk', () => ({ loadAdyen: mockLoadAdyen }));
vi.mock('./paymentIntegrationFormLoaders', () => ({
    loadAdyenPaymentIntegrationForm: mockLoadAdyenForm,
    loadStripePaymentIntegrationForm: mockLoadStripeForm,
}));

describe('preloadPaymentIntegrationForms', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        [mockLoadAdyen, mockLoadAdyenForm, mockLoadStripeForm].forEach((load) =>
            load.mockResolvedValue({}),
        );
    });

    it('loads only what the gateways on offer need', async () => {
        await preloadPaymentIntegrationForms([
            createPaymentMethodOptionEntry({ gateway: 'STRIPE' }),
        ]);

        expect(mockLoadStripeForm).toHaveBeenCalledOnce();
        expect(mockLoadAdyenForm).not.toHaveBeenCalled();
        expect(mockLoadAdyen).not.toHaveBeenCalled();

        await preloadPaymentIntegrationForms([
            createPaymentMethodOptionEntry({ gateway: 'ADYEN' }),
        ]);

        expect(mockLoadAdyenForm).toHaveBeenCalledOnce();
        expect(mockLoadAdyen).toHaveBeenCalledOnce();
    });

    it('settles when a load fails, leaving the failure to the form', async () => {
        mockLoadAdyen.mockRejectedValue(new Error('offline'));

        await expect(
            preloadPaymentIntegrationForms([createPaymentMethodOptionEntry({ gateway: 'ADYEN' })]),
        ).resolves.toBeUndefined();
    });
});
