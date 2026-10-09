import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { AuthorizePaymentPayload, BillingPeriod } from '@solvimon/solvimon-types';
import type { ApplePayConfiguration } from '@adyen/adyen-web';
import type { ExpressPaymentMethodApplePayProps } from './ExpressPaymentMethodApplePay.types';
import ExpressPaymentMethodApplePay from './ExpressPaymentMethodApplePay.vue';

const mockApplePayInstance = {
    isAvailable: vi.fn().mockResolvedValue(true),
    mount: vi.fn(),
    unmount: vi.fn(),
};

// The SDK calls this with `new`, which rules out `mockReturnValue`. A plain function returns the
// instance either way and still records its constructor arguments — a class implementation is what
// the spy cannot call.
const mockApplePay = vi.fn(function (_checkout: unknown, _configuration: ApplePayConfiguration) {
    return mockApplePayInstance;
});
const mockAdyenCheckout = vi.fn().mockResolvedValue({});

// The components reach the SDK through this loader, which is the SDK's only
// `import('@adyen/adyen-web')`; mocking it keeps this spec to the names it uses.
vi.mock('@/utils/adyenSdk', () => ({
    loadAdyenSdk: () =>
        Promise.resolve({
            AdyenCheckout: mockAdyenCheckout,
            ApplePay: mockApplePay,
        }),
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
        onSubmit: config.onSubmit,
    })),
    createReturnUrl: vi.fn(
        ({ paymentAcceptorId, redirectUrl }) =>
            `https://return.url?payment_acceptor_id=${paymentAcceptorId}&redirect=${redirectUrl}`,
    ),
    transformObjectToAdyenObject: vi.fn((obj) => obj),
}));

/** A payment the gateway completed: the status alone does not say the money moved. */
const mockAuthorizePayment = vi.fn().mockResolvedValue({
    status: 'SUCCESS',
    payment: {
        id: 'test-payment-id',
        result: 'AUTHORIZED',
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
        mockApplePayInstance.unmount.mockClear();
        mockAdyenCheckout.mockResolvedValue({});
        mockAuthorizePayment.mockResolvedValue({
            status: 'SUCCESS',
            payment: {
                id: 'test-payment-id',
                result: 'AUTHORIZED',
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
                    // Where the customer manages the subscription Apple Pay signs them up for;
                    // it used to point at google.com.
                    managementURL: mockProps.billingInformation.managementURL,
                    regularBilling: expect.objectContaining({
                        label: mockProps.billingInformation.regular!.label,
                        amount: mockProps.billingInformation.regular!.amount.quantity.toString(),
                    }),
                }),
                requiredBillingContactFields: ['postalAddress'],
                requiredShippingContactFields: ['email'],
            }),
        );
    });

    it('asks for no recurring mandate when the order renews at nothing', async () => {
        const { regular: _regular, ...billingInformation } = mockProps.billingInformation;

        mount(ExpressPaymentMethodApplePay, {
            props: { ...mockProps, billingInformation },
        });

        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // A sheet carrying a recurring request states a price for every period to come, so an
        // order that has no such period must not carry one at all.
        expect(mockApplePay).toHaveBeenCalledWith(
            expect.anything(),
            expect.not.objectContaining({ recurringPaymentRequest: expect.anything() }),
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

            await onPaymentMethodSelected(
                mockResolve,
                mockReject,
                mockEvent as unknown as ApplePayJS.ApplePayPaymentMethodSelectedEvent,
            );

            // Checkout form fields: a `postal_code` here never reached the form, so the preview
            // was re-priced without the postal code the tax depends on.
            expect(mockOnBillingInformationChange).toHaveBeenCalledWith({
                postalCode: '1234AB',
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
                        label: mockProps.billingInformation.regular!.label,
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
            onError(mockError as unknown as Parameters<typeof onError>[0]);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'APPLE_PAY_ERROR',
                'Apple Pay error',
                expect.objectContaining({
                    reason: 'APPLE_PAY_ERROR',
                    gateway: 'ADYEN',
                    reference: expect.stringMatching(/^SV-/),
                }),
                mockError,
            );
        }
    });

    type AuthorizedArgs = Parameters<NonNullable<ApplePayConfiguration['onAuthorized']>>;

    /** The sheet's authorization, which starts Adyen's payment flow rather than charging. */
    const authorizedEventData = {
        authorizedEvent: {
            payment: {
                token: { paymentMethod: { test: 'data' }, paymentData: { test: 'browser' } },
                billingContact: {
                    addressLines: ['Main street 1', 'Second floor'],
                    locality: 'Amsterdam',
                    administrativeArea: 'NH',
                    postalCode: '1000AA',
                    countryCode: 'NL',
                },
                shippingContact: { emailAddress: 'customer@example.com' },
            },
        },
        billingAddress: null,
    } as unknown as AuthorizedArgs[0];

    /** What Adyen hands `onSubmit` once the authorization has been resolved. */
    const submitState = {
        data: {
            paymentMethod: { type: 'applepay', applePayToken: 'token-abc' },
            riskData: { clientData: 'risk-abc' },
        },
        isValid: true,
    };

    const mountAndSettle = async (props = mockProps) => {
        const wrapper = mount(ExpressPaymentMethodApplePay, { props });

        await nextTick();
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 0));

        return wrapper;
    };

    const applePayConfig = () => mockApplePay.mock.calls[0]?.[1];

    const authorize = (actions: AuthorizedArgs[1]) =>
        applePayConfig().onAuthorized?.(authorizedEventData, actions);

    /** Adyen's `onSubmit` reports nothing back, so a test waits for the work it started. */
    const submit = async (state: unknown, actions: unknown) => {
        mockAdyenCheckout.mock.calls[0]?.[0]?.onSubmit(state, undefined, actions);
        await new Promise((resolve) => setTimeout(resolve, 0));
    };

    describe('authorizing', () => {
        // Adyen's contract: resolving is what starts the payment flow, so the charge belongs in
        // `onSubmit`. Charging here as well took the money a second time.
        it('resolves the authorization without charging, so the flow can submit', async () => {
            const wrapper = await mountAndSettle();
            const actions = { resolve: vi.fn(), reject: vi.fn() };

            await authorize(actions);

            expect(actions.resolve).toHaveBeenCalled();
            expect(mockAuthorizePayment).not.toHaveBeenCalled();
            expect(wrapper.emitted('payment-success')).toBeFalsy();
        });

        it('stops before the sheet charges anything when the checkout form is invalid', async () => {
            const wrapper = await mountAndSettle({
                ...mockProps,
                validateOnSubmit: vi.fn().mockResolvedValue(false),
            });
            const actions = { resolve: vi.fn(), reject: vi.fn() };

            await authorize(actions);

            expect(actions.reject).toHaveBeenCalled();
            expect(actions.resolve).not.toHaveBeenCalled();
            expect(mockAuthorizePayment).not.toHaveBeenCalled();
            expect(wrapper.emitted('payment-failed')).toBeTruthy();
        });
    });

    describe('what the sheet collected', () => {
        // The customer never fills the checkout form in this flow, so validating it before handing
        // over what Apple Pay collected rejected every express payment.
        it('hands over the address and email before the form is checked', async () => {
            const validateOnSubmit = vi.fn().mockResolvedValue(true);
            const wrapper = await mountAndSettle({ ...mockProps, validateOnSubmit });
            const actions = { resolve: vi.fn(), reject: vi.fn() };

            await authorize(actions);

            const [billingInformation] =
                wrapper.emitted('update-billing-information')?.at(-1) ?? [];

            expect(billingInformation).toEqual({
                line1: 'Main street 1',
                line2: 'Second floor',
                state: 'NH',
                postal_code: '1000AA',
                city: 'Amsterdam',
                country: 'NL',
                email: 'customer@example.com',
            });
            expect(validateOnSubmit).toHaveBeenCalled();
            expect(actions.resolve).toHaveBeenCalled();
        });

        it('rejects rather than hanging the sheet when the check throws', async () => {
            const wrapper = await mountAndSettle({
                ...mockProps,
                validateOnSubmit: vi.fn().mockRejectedValue(new Error('boom')),
            });
            const actions = { resolve: vi.fn(), reject: vi.fn() };

            await authorize(actions);

            expect(actions.reject).toHaveBeenCalled();
            expect(actions.resolve).not.toHaveBeenCalled();
            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
        });
    });

    describe('paying', () => {
        it('charges what the authorization is for, with the subscription it creates', async () => {
            const context: AuthorizePaymentPayload['context'] = {
                type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
                init_pricing_plan_subscription: {
                    template_pricing_plan_subscription_id: 'ppsu_1',
                    customer_details: { email: 'customer@example.com', type: 'INDIVIDUAL' },
                },
            };
            const wrapper = await mountAndSettle({ ...mockProps, context });
            const actions = { resolve: vi.fn(), reject: vi.fn() };

            await submit(submitState, actions);

            expect(mockAuthorizePayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    payment_acceptor_id: 'test-acceptor-id',
                    payment_gateway_variant: 'ADYEN',
                    amount: mockProps.amount,
                    // Built by Adyen rather than by hand: the encrypted credential used to be sent
                    // as `browser_info`, stringified to "[object Object]".
                    adyen: expect.objectContaining({
                        payment_method: submitState.data.paymentMethod,
                        store_payment_method: true,
                    }),
                    context,
                }),
            );
            expect(actions.resolve).toHaveBeenCalled();
            expect(wrapper.emitted('payment-success')).toHaveLength(1);
        });

        it('tells the checkout a refused payment failed, rather than resolving the sheet', async () => {
            mockAuthorizePayment.mockResolvedValueOnce({ status: 'REFUSED', payment: {} });
            const wrapper = await mountAndSettle();
            const actions = { resolve: vi.fn(), reject: vi.fn() };

            await submit(submitState, actions);

            expect(actions.reject).toHaveBeenCalled();
            expect(actions.resolve).not.toHaveBeenCalled();
            expect(wrapper.emitted('payment-success')).toBeFalsy();
            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
        });

        it('treats an authorization the gateway did not complete as a failure', async () => {
            mockAuthorizePayment.mockResolvedValueOnce({
                status: 'SUCCESS',
                payment: { result: 'REFUSED' },
            });
            const wrapper = await mountAndSettle();
            const actions = { resolve: vi.fn(), reject: vi.fn() };

            await submit(submitState, actions);

            expect(actions.reject).toHaveBeenCalled();
            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
        });

        it('reports a payment that could not be sent at all', async () => {
            mockAuthorizePayment.mockRejectedValueOnce(new Error('network'));
            const wrapper = await mountAndSettle();
            const actions = { resolve: vi.fn(), reject: vi.fn() };

            await submit(submitState, actions);

            expect(actions.reject).toHaveBeenCalled();
            expect(wrapper.emitted('payment-failed')).toHaveLength(1);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'APPLE_PAY_AUTHORIZATION_FAILED',
                'Apple Pay authorization failed',
                expect.anything(),
                expect.anything(),
            );
        });
    });

    describe('lifecycle', () => {
        // The sheet quotes the amount it was built with, so a promo code or a seat change would
        // otherwise have the customer authorizing a total the checkout no longer shows.
        it('rebuilds the button when the amount changes', async () => {
            const wrapper = await mountAndSettle();

            expect(mockApplePay).toHaveBeenCalledTimes(1);

            await wrapper.setProps({ amount: { currency: 'EUR', quantity: '12.50' } });
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(mockApplePayInstance.unmount).toHaveBeenCalled();
            expect(mockApplePay).toHaveBeenCalledTimes(2);
        });

        // `amount` is rebuilt by every invoice preview, and the sheet asks for one as it opens.
        it('leaves the button alone when the amount is rebuilt with the same value', async () => {
            const wrapper = await mountAndSettle();

            await wrapper.setProps({ amount: { currency: 'EUR', quantity: '10.00' } });
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(mockApplePayInstance.unmount).not.toHaveBeenCalled();
            expect(mockApplePay).toHaveBeenCalledTimes(1);
        });

        it('says so when the device cannot pay with Apple Pay', async () => {
            mockApplePayInstance.isAvailable.mockRejectedValueOnce(new Error('unavailable'));

            const wrapper = await mountAndSettle();

            expect(wrapper.emitted('unavailable')).toHaveLength(1);
            expect(wrapper.emitted('ready')).toBeFalsy();
        });

        it('leaves nothing mounted behind it', async () => {
            const wrapper = await mountAndSettle();

            wrapper.unmount();

            expect(mockApplePayInstance.unmount).toHaveBeenCalled();
        });
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
                    ...mockProps.billingInformation.regular!,
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
