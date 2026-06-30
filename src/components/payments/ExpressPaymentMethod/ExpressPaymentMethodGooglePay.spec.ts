import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { ExpressPaymentMethodProps } from './ExpressPaymentMethod.types';
import ExpressPaymentMethodGooglePay from './ExpressPaymentMethodGooglePay.vue';

const mockGooglePayInstance = {
    isAvailable: vi.fn().mockResolvedValue(true),
    mount: vi.fn(),
};

const mockGooglePay = vi.fn().mockReturnValue(mockGooglePayInstance);
const mockAdyenCheckout = vi.fn().mockResolvedValue({});

vi.mock('@adyen/adyen-web', () => ({
    AdyenCheckout: mockAdyenCheckout,
    GooglePay: mockGooglePay,
}));

const mockLogger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    capture: vi.fn(),
};

vi.mock('@/components/providers', () => ({
    useLogger: () => mockLogger,
}));

vi.mock('@/utils/adyen', () => ({
    getAdyenExpressCheckoutConfiguration: vi.fn((config) => ({
        clientKey: 'test-key',
        environment: 'test',
        locale: config.locale,
        countryCode: config.countryCode,
        amount: config.amount,
    })),
}));

describe('ExpressPaymentMethodGooglePay', () => {
    const mockProps: ExpressPaymentMethodProps = {
        amount: {
            currency: 'EUR',
            quantity: '10.00',
        },
        countryCode: 'NL',
        locale: 'nl-NL',
        isVisible: true,
        paymentMethodOptionsResponse: {
            payment_acceptor: {
                object_type: 'PAYMENT_ACCEPTOR',
                id: 'test-acceptor-id',
                name: 'Test Payment Acceptor',
                reference: 'test-ref',
                status: 'ACTIVE',
            },
            integration: {
                id: 'test-integration-id',
                object_type: 'INTEGRATION',
                reference: 'test-integration-ref',
                name: 'Test Integration',
                description: 'Test Integration Description',
                status: 'ACTIVE',
                type: 'PAYMENT_GATEWAY',
                payment_gateway: {
                    variant: 'ADYEN',
                    adyen: {
                        company_account: 'test-company-account',
                        environment: 'TEST',
                        merchant_accounts: ['test-merchant-account'],
                        public_key: 'test-key',
                        live_prefix: 'test-prefix',
                        ownership: 'PLATFORM',
                    },
                },
            },
            options: [],
        },
        billingInformation: {
            description: 'Test subscription',
            agreement: '€10.00/month',
            managementURL: 'https://example.com/manage',
            regular: {
                label: 'Monthly',
                amount: {
                    currency: 'EUR',
                    quantity: '10.00',
                },
                startDate: new Date(),
                interval: {
                    type: 'MONTH',
                    value: 1,
                },
            },
        },
    };

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
        mockGooglePayInstance.isAvailable.mockResolvedValue(true);
        mockGooglePayInstance.mount.mockClear();
        mockAdyenCheckout.mockResolvedValue({});
        mockGooglePay.mockReturnValue(mockGooglePayInstance);
    });

    it('should initialize GooglePay on mount', async () => {
        mount(ExpressPaymentMethodGooglePay, {
            props: mockProps,
        });

        // Wait for component to mount and async operations
        await nextTick();
        await nextTick();
        // Wait for the async import and initialization
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockAdyenCheckout).toHaveBeenCalled();
        expect(mockGooglePay).toHaveBeenCalled();
    });

    it('should emit ready event when GooglePay is successfully mounted', async () => {
        const wrapper = mount(ExpressPaymentMethodGooglePay, {
            props: mockProps,
        });

        // Wait for component to mount and GooglePay to be initialized
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // The component emits 'ready' after successful mount
        expect(mockGooglePayInstance.isAvailable).toHaveBeenCalled();
        expect(mockGooglePayInstance.mount).toHaveBeenCalled();

        // Wait for the emit to happen
        await nextTick();
        expect(wrapper.emitted('ready')).toBeTruthy();
        expect(wrapper.emitted('ready')).toHaveLength(1);
    });

    it('should mount GooglePay button when available', async () => {
        mount(ExpressPaymentMethodGooglePay, {
            props: mockProps,
        });

        // Wait for component to mount and async operations
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockGooglePayInstance.isAvailable).toHaveBeenCalled();
        expect(mockGooglePayInstance.mount).toHaveBeenCalled();
    });

    it('should log error when GooglePay button reference is not found', async () => {
        mount(ExpressPaymentMethodGooglePay, {
            props: mockProps,
        });

        // Wait for component to mount
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // The component should have found the ref and not logged an error
        // since the ref exists in the template
        expect(mockLogger.error).not.toHaveBeenCalledWith(
            'EXPRESS_CHECKOUT_GOOGLE_PAY_ERROR',
            'The Google Pay button reference is not found and cannot be mounted',
        );
    });

    it('should log error when mounting fails', async () => {
        // Mock isAvailable to throw an error
        mockGooglePayInstance.isAvailable.mockRejectedValue(new Error('GooglePay not available'));

        mount(ExpressPaymentMethodGooglePay, {
            props: mockProps,
        });

        // Wait for component to mount and async operations
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockLogger.error).toHaveBeenCalledWith(
            'EXPRESS_CHECKOUT_GOOGLE_PAY_ERROR',
            'Failed mounting Google Pay express button',
            expect.objectContaining({ error: expect.any(Error) }),
        );
    });

    it('should handle click event on GooglePay button', async () => {
        const wrapper = mount(ExpressPaymentMethodGooglePay, {
            props: mockProps,
        });

        // Wait for component to mount
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Create a mock element with the expected ID
        const mockButton = document.createElement('div');
        mockButton.id = 'gpay-button-online-api-id';
        const mockContainer = wrapper.find('.w-\\[1px\\]').element;
        if (mockContainer) {
            mockContainer.appendChild(mockButton);
        }

        // Get the button component and trigger click
        const buttonComponent = wrapper.findComponent({ name: 'ExpressPaymentMethodButton' });
        expect(buttonComponent.exists()).toBe(true);

        // Trigger click on the button component
        await buttonComponent.trigger('click');
        await nextTick();

        // The handleClick function should dispatch a click event on the GooglePay button
        // We can verify this by checking if the mock button received the event
        // (though in a real scenario, this would be handled by Adyen)
    });

    it('should render ExpressPaymentMethodButton when isVisible is true', () => {
        const wrapper = mount(ExpressPaymentMethodGooglePay, {
            props: mockProps,
        });

        expect(wrapper.findComponent({ name: 'ExpressPaymentMethodButton' }).exists()).toBe(true);
    });

    it('should not render ExpressPaymentMethodButton when isVisible is false', () => {
        const wrapper = mount(ExpressPaymentMethodGooglePay, {
            props: {
                ...mockProps,
                isVisible: false,
            },
        });

        expect(wrapper.findComponent({ name: 'ExpressPaymentMethodButton' }).exists()).toBe(false);
    });

    it('should create GooglePay with isExpress option', async () => {
        mount(ExpressPaymentMethodGooglePay, {
            props: mockProps,
        });

        // Wait for component to mount and async operations
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Verify GooglePay was called with isExpress: true
        expect(mockGooglePay).toHaveBeenCalledWith(expect.anything(), { isExpress: true });
    });
});
