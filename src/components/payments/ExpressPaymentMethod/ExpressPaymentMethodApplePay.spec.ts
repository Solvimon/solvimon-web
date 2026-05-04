import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { BillingPeriod } from '@solvimon/solvimon-types';
import type { ExpressPaymentMethodApplePayProps } from './ExpressPaymentMethodApplePay.types';
import ExpressPaymentMethodApplePay from './ExpressPaymentMethodApplePay.vue';

const mockApplePayInstance = {
    isAvailable: vi.fn().mockResolvedValue(true),
    mount: vi.fn(),
};

const mockApplePay = vi.fn().mockReturnValue(mockApplePayInstance);
const mockAdyenCheckout = vi.fn().mockResolvedValue({});

vi.mock('@adyen/adyen-web/auto', () => ({
    AdyenCheckout: mockAdyenCheckout,
    ApplePay: mockApplePay,
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
    useConfig: () => ({
        apiUrls: {
            transaction: 'https://api.test.com',
        },
    }),
}));

vi.mock('@/utils/adyen', () => ({
    getAdyenExpressCheckoutConfiguration: vi.fn((config) => ({
        clientKey: 'test-key',
        environment: 'test',
        locale: config.locale,
        countryCode: config.countryCode,
        amount: config.amount,
    })),
    createReturnUrl: vi.fn(
        ({ paymentAcceptorId, redirectUrl }) =>
            `https://return.url?payment_acceptor_id=${paymentAcceptorId}&redirect=${redirectUrl}`,
    ),
    transformObjectToAdyenObject: vi.fn((obj) => obj),
}));

const mockAuthorizePayment = vi.fn().mockResolvedValue({
    status: 'SUCCESS',
    payment: {
        id: 'test-payment-id',
    },
});

vi.mock('@/services/payments', () => ({
    createPaymentsService: () => ({
        authorizePayment: mockAuthorizePayment,
    }),
}));

describe('ExpressPaymentMethodApplePay', () => {
    const mockOnBillingInformationChange = vi.fn().mockResolvedValue({
        invoicePreview: {
            invoice_amount_including_tax: {
                currency: 'EUR',
                quantity: '10.00',
            },
        },
        trialInvoicePreview: null,
    });

    const mockProps: ExpressPaymentMethodApplePayProps = {
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
                startDate: new Date('2024-01-01'),
                interval: {
                    type: 'MONTH' as BillingPeriod['type'],
                    value: 1,
                },
            },
        },
        onBillingInformationChange: mockOnBillingInformationChange,
    };

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
        mockApplePayInstance.isAvailable.mockResolvedValue(true);
        mockApplePayInstance.mount.mockClear();
        mockAdyenCheckout.mockResolvedValue({});
        mockApplePay.mockReturnValue(mockApplePayInstance);
        mockAuthorizePayment.mockResolvedValue({
            status: 'SUCCESS',
            payment: {
                id: 'test-payment-id',
            },
        });
        mockOnBillingInformationChange.mockResolvedValue({
            invoicePreview: {
                invoice_amount_including_tax: {
                    currency: 'EUR',
                    quantity: '10.00',
                },
            },
            trialInvoicePreview: null,
        });
    });

    it('should initialize ApplePay on mount', async () => {
        mount(ExpressPaymentMethodApplePay, {
            props: mockProps,
        });

        // Wait for component to mount and async operations
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockAdyenCheckout).toHaveBeenCalled();
        expect(mockApplePay).toHaveBeenCalled();
    });

    it('should emit ready event when ApplePay is successfully mounted', async () => {
        const wrapper = mount(ExpressPaymentMethodApplePay, {
            props: mockProps,
        });

        // Wait for component to mount and ApplePay to be initialized
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockApplePayInstance.isAvailable).toHaveBeenCalled();
        expect(mockApplePayInstance.mount).toHaveBeenCalled();

        // Wait for the emit to happen
        await nextTick();
        expect(wrapper.emitted('ready')).toBeTruthy();
        expect(wrapper.emitted('ready')).toHaveLength(1);
    });

    it('should create ApplePay with recurring payment request configuration', async () => {
        mount(ExpressPaymentMethodApplePay, {
            props: mockProps,
        });

        // Wait for component to mount and async operations
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Verify ApplePay was called with correct configuration
        expect(mockApplePay).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                isExpress: true,
                recurringPaymentRequest: expect.objectContaining({
                    paymentDescription: mockProps.billingInformation.description,
                    billingAgreement: mockProps.billingInformation.agreement,
                    regularBilling: expect.objectContaining({
                        label: mockProps.billingInformation.regular.label,
                        amount: mockProps.billingInformation.regular.amount.quantity.toString(),
                    }),
                }),
                requiredBillingContactFields: ['postalAddress'],
                requiredShippingContactFields: ['email'],
            }),
        );
    });

    it('should include trial billing when trial information is provided', async () => {
        const propsWithTrial = {
            ...mockProps,
            billingInformation: {
                ...mockProps.billingInformation,
                trial: {
                    label: '3-day free trial',
                    amount: {
                        currency: 'EUR',
                        quantity: '0.00',
                    },
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-04'),
                },
            },
        };

        mount(ExpressPaymentMethodApplePay, {
            props: propsWithTrial,
        });

        // Wait for component to mount and async operations
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Verify trial billing is included
        const applePayCallArgs = mockApplePay.mock.calls[0];
        const applePayConfig = applePayCallArgs?.[1];
        expect(applePayConfig?.recurringPaymentRequest?.trialBilling).toBeDefined();
        expect(applePayConfig?.recurringPaymentRequest?.trialBilling?.label).toBe(
            '3-day free trial',
        );
    });

    it('should handle onPaymentMethodSelected callback', async () => {
        const wrapper = mount(ExpressPaymentMethodApplePay, {
            props: mockProps,
        });

        // Wait for component to mount
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Get the onPaymentMethodSelected callback
        const applePayCallArgs = mockApplePay.mock.calls[0];
        const applePayConfig = applePayCallArgs?.[1];
        const onPaymentMethodSelected = applePayConfig?.onPaymentMethodSelected;

        expect(onPaymentMethodSelected).toBeDefined();

        if (onPaymentMethodSelected) {
            const mockResolve = vi.fn();
            const mockReject = vi.fn();
            const mockEvent = {
                paymentMethod: {
                    billingContact: {
                        postalCode: '1234AB',
                        locality: 'Amsterdam',
                        countryCode: 'NL',
                    },
                },
            };

            await onPaymentMethodSelected(mockResolve, mockReject, mockEvent);

            // Verify onBillingInformationChange was called
            expect(mockOnBillingInformationChange).toHaveBeenCalledWith({
                postal_code: '1234AB',
                city: 'Amsterdam',
                country: 'NL',
            });

            // Verify update-billing-information was emitted
            expect(wrapper.emitted('update-billing-information')).toBeTruthy();
            expect(wrapper.emitted('update-billing-information')?.[0]).toEqual([
                {
                    postal_code: '1234AB',
                    city: 'Amsterdam',
                    country: 'NL',
                },
            ]);

            // Verify resolve was called with new total
            expect(mockResolve).toHaveBeenCalledWith(
                expect.objectContaining({
                    newTotal: expect.objectContaining({
                        label: mockProps.billingInformation.regular.label,
                        amount: '10.00',
                    }),
                }),
            );
        }
    });

    it('should handle onError callback', async () => {
        mount(ExpressPaymentMethodApplePay, {
            props: mockProps,
        });

        // Wait for component to mount
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Get the onError callback
        const applePayCallArgs = mockApplePay.mock.calls[0];
        const applePayConfig = applePayCallArgs?.[1];
        const onError = applePayConfig?.onError;

        expect(onError).toBeDefined();

        if (onError) {
            const mockError = new Error('Test error');
            onError(mockError);

            expect(mockLogger.error).toHaveBeenCalledWith('APPLE_PAY_ERROR', 'Apple Pay error', {
                error: mockError,
            });
        }
    });

    it('should handle onAuthorized callback with successful payment', async () => {
        const wrapper = mount(ExpressPaymentMethodApplePay, {
            props: mockProps,
        });

        // Wait for component to mount
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Get the onAuthorized callback
        const applePayCallArgs = mockApplePay.mock.calls[0];
        const applePayConfig = applePayCallArgs?.[1];
        const onAuthorized = applePayConfig?.onAuthorized;

        expect(onAuthorized).toBeDefined();

        if (onAuthorized) {
            const mockResolve = vi.fn();
            const mockReject = vi.fn();
            const mockData = {
                authorizedEvent: {
                    payment: {
                        token: {
                            paymentMethod: { test: 'data' },
                            paymentData: { test: 'browser' },
                        },
                        billingContact: null,
                    },
                },
                billingAddress: null,
            };
            const mockActions = {
                resolve: mockResolve,
                reject: mockReject,
            };

            await onAuthorized(mockData, mockActions);

            // Verify authorizePayment was called
            expect(mockAuthorizePayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    payment_acceptor_id: 'test-acceptor-id',
                    payment_gateway_variant: 'ADYEN',
                    amount: mockProps.amount,
                    adyen: expect.objectContaining({
                        store_payment_method: true,
                    }),
                }),
            );

            // Verify resolve was called
            expect(mockResolve).toHaveBeenCalled();
            expect(mockReject).not.toHaveBeenCalled();
        }
    });

    it('should handle onAuthorized callback with payment failure', async () => {
        mockAuthorizePayment.mockResolvedValueOnce({
            status: 'FAILURE',
        });

        mount(ExpressPaymentMethodApplePay, {
            props: mockProps,
        });

        // Wait for component to mount
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Get the onAuthorized callback
        const applePayCallArgs = mockApplePay.mock.calls[0];
        const applePayConfig = applePayCallArgs?.[1];
        const onAuthorized = applePayConfig?.onAuthorized;

        if (onAuthorized) {
            const mockResolve = vi.fn();
            const mockReject = vi.fn();
            const mockData = {
                authorizedEvent: {
                    payment: {
                        token: {
                            paymentMethod: { test: 'data' },
                            paymentData: { test: 'browser' },
                        },
                        billingContact: null,
                    },
                },
                billingAddress: null,
            };
            const mockActions = {
                resolve: mockResolve,
                reject: mockReject,
            };

            await onAuthorized(mockData, mockActions);

            // Verify reject was called
            expect(mockReject).toHaveBeenCalled();
            expect(mockResolve).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'APPLE_PAY_AUTHORIZATION_FAILED',
                'Payment authorization failed',
                expect.anything(),
            );
        }
    });

    it('should handle onAuthorized callback with missing paymentMethod', async () => {
        mount(ExpressPaymentMethodApplePay, {
            props: mockProps,
        });

        // Wait for component to mount
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Get the onAuthorized callback
        const applePayCallArgs = mockApplePay.mock.calls[0];
        const applePayConfig = applePayCallArgs?.[1];
        const onAuthorized = applePayConfig?.onAuthorized;

        if (onAuthorized) {
            const mockResolve = vi.fn();
            const mockReject = vi.fn();
            const mockData = {
                authorizedEvent: {
                    // Missing paymentMethod
                    browserInfo: { test: 'browser' },
                    riskData: { test: 'risk' },
                },
                billingAddress: null,
            };
            const mockActions = {
                resolve: mockResolve,
                reject: mockReject,
            };

            await onAuthorized(mockData, mockActions);

            // Verify reject was called
            expect(mockReject).toHaveBeenCalled();
            expect(mockResolve).not.toHaveBeenCalled();
        }
    });

    it('should handle click event on ApplePay button', async () => {
        const wrapper = mount(ExpressPaymentMethodApplePay, {
            props: mockProps,
        });

        // Wait for component to mount
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Create a mock apple-pay-button element
        const mockButton = document.createElement('apple-pay-button');
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

        // The handleClick function should dispatch a click event on the apple-pay-button
        // (though in a real scenario, this would be handled by Adyen)
    });

    it('should render ExpressPaymentMethodButton when isVisible is true', () => {
        const wrapper = mount(ExpressPaymentMethodApplePay, {
            props: mockProps,
        });

        expect(wrapper.findComponent({ name: 'ExpressPaymentMethodButton' }).exists()).toBe(true);
    });

    it('should not render ExpressPaymentMethodButton when isVisible is false', () => {
        const wrapper = mount(ExpressPaymentMethodApplePay, {
            props: {
                ...mockProps,
                isVisible: false,
            },
        });

        expect(wrapper.findComponent({ name: 'ExpressPaymentMethodButton' }).exists()).toBe(false);
    });

    it('should convert WEEK interval to days in recurring payment config', async () => {
        const propsWithWeekInterval = {
            ...mockProps,
            billingInformation: {
                ...mockProps.billingInformation,
                regular: {
                    ...mockProps.billingInformation.regular,
                    interval: {
                        type: 'WEEK' as BillingPeriod['type'],
                        value: 2,
                    },
                },
            },
        };

        mount(ExpressPaymentMethodApplePay, {
            props: propsWithWeekInterval,
        });

        // Wait for component to mount
        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Verify the interval was converted from weeks to days
        const applePayCallArgs = mockApplePay.mock.calls[0];
        const applePayConfig = applePayCallArgs?.[1];
        const regularBilling = applePayConfig?.recurringPaymentRequest?.regularBilling;

        expect(regularBilling?.recurringPaymentIntervalUnit).toBe('day');
        expect(regularBilling?.recurringPaymentIntervalCount).toBe(14); // 2 weeks = 14 days
    });
});
