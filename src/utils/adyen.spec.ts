import {
    getAdyenClientKeyFromPaymentMethodOptionsResponse,
    transformToAdyenAmount,
    mapAdyenPaymentMethods,
    mapAdyenPaymentMethod,
    createReturnUrl,
    getAdyenEnvironmentFromPaymentMethodOptionsResponse,
    getAdyenExpressCheckoutConfiguration,
    transformObjectToAdyenObject,
    PAYMENT_ACCEPTOR_ID_QUERY_STRING,
} from './adyen';
import type {
    PaymentMethodOptionResponseEntry,
    Amount,
    PaymentAcceptor,
    PaymentIntegration,
} from '@solvimon/solvimon-types';

// Helper function to create a minimal PaymentAcceptor
function createMockPaymentAcceptor(overrides: Partial<PaymentAcceptor> = {}): PaymentAcceptor {
    return {
        object_type: 'PAYMENT_ACCEPTOR',
        id: 'paya_test',
        name: 'Test Payment Acceptor',
        reference: 'test_ref',
        status: 'ACTIVE',
        ...overrides,
    } satisfies PaymentAcceptor;
}

// Helper function to create a minimal PaymentIntegration
function createMockPaymentIntegration(
    overrides: Partial<PaymentIntegration> = {},
): PaymentIntegration {
    return {
        id: 'intg_test',
        object_type: 'INTEGRATION',
        reference: 'test_integration_ref',
        name: 'Test Integration',
        description: 'Test Integration Description',
        status: 'ACTIVE',
        type: 'PAYMENT_GATEWAY',
        payment_gateway: { variant: 'ADYEN' },
        ...overrides,
    } satisfies PaymentIntegration;
}

describe('adyen utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAdyenClientKeyFromPaymentMethodOptionsResponse', () => {
        it('should return the client key when present', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                        adyen: {
                            public_key: 'test_key_123',
                            environment: 'TEST',
                            company_account: 'test',
                            merchant_accounts: [],
                            live_prefix: '',
                            ownership: 'PLATFORM',
                        },
                    },
                }),
                options: [],
            };

            const result = getAdyenClientKeyFromPaymentMethodOptionsResponse(
                paymentMethodOptionResponse,
            );

            expect(result).toBe('test_key_123');
        });

        it('should return undefined when adyen gateway is not present', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                    },
                }),
                options: [],
            };

            const result = getAdyenClientKeyFromPaymentMethodOptionsResponse(
                paymentMethodOptionResponse,
            );

            expect(result).toBeUndefined();
        });

        it('should return undefined when payment gateway is not present', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration(),
                options: [],
            };

            const result = getAdyenClientKeyFromPaymentMethodOptionsResponse(
                paymentMethodOptionResponse,
            );

            expect(result).toBeUndefined();
        });
    });

    describe('transformToAdyenAmount', () => {
        it('should transform USD amount correctly', () => {
            const amount: Amount = {
                quantity: '10.50',
                currency: 'USD',
            };

            const result = transformToAdyenAmount(amount);

            expect(result.currency).toBe('USD');
            expect(result.value).toBe(1050); // 10.50 * 100 (2 decimal places for USD)
        });

        it('should transform EUR amount correctly', () => {
            const amount: Amount = {
                quantity: '25.99',
                currency: 'EUR',
            };

            const result = transformToAdyenAmount(amount);

            expect(result.currency).toBe('EUR');
            expect(result.value).toBe(2599); // 25.99 * 100
        });

        it('should handle amounts with more decimal places', () => {
            const amount: Amount = {
                quantity: '10.1234',
                currency: 'USD',
            };

            const result = transformToAdyenAmount(amount);

            expect(result.currency).toBe('USD');
            // USD has 2 decimal places, so 10.1234 * 100 = 1012.34, rounded to 1012
            expect(result.value).toBe(1012);
        });

        it('should handle zero amount', () => {
            const amount: Amount = {
                quantity: '0',
                currency: 'USD',
            };

            const result = transformToAdyenAmount(amount);

            expect(result.currency).toBe('USD');
            expect(result.value).toBe(0);
        });

        it('should handle large amounts', () => {
            const amount: Amount = {
                quantity: '999999.99',
                currency: 'USD',
            };

            const result = transformToAdyenAmount(amount);

            expect(result.currency).toBe('USD');
            expect(result.value).toBe(99999999);
        });
    });

    describe('mapAdyenPaymentMethod', () => {
        it('should map basic payment method', () => {
            const adyen = {
                type: 'scheme',
                name: 'Credit Card',
            };

            const result = mapAdyenPaymentMethod(adyen);

            expect(result).toEqual({
                type: 'scheme',
                name: 'Credit Card',
            });
        });

        it('should map payment method with issuers', () => {
            const adyen = {
                type: 'ideal',
                name: 'iDEAL',
                issuers: [
                    { id: '1', name: 'Bank 1' },
                    { id: '2', name: 'Bank 2' },
                ],
            };

            const result = mapAdyenPaymentMethod(adyen);

            expect(result).toEqual({
                type: 'ideal',
                name: 'iDEAL',
                issuers: [
                    { id: '1', name: 'Bank 1' },
                    { id: '2', name: 'Bank 2' },
                ],
            });
        });

        it('should map payment method with brands', () => {
            const adyen = {
                type: 'scheme',
                name: 'Credit Card',
                brands: ['visa', 'mc', 'amex'],
            };

            const result = mapAdyenPaymentMethod(adyen);

            expect(result).toEqual({
                type: 'scheme',
                name: 'Credit Card',
                brands: ['visa', 'mc', 'amex'],
            });
        });

        it('should map payment method with funding source', () => {
            const adyen = {
                type: 'scheme',
                name: 'Credit Card',
                funding_source: 'debit' as const,
            };

            const result = mapAdyenPaymentMethod(adyen);

            expect(result).toEqual({
                type: 'scheme',
                name: 'Credit Card',
                fundingSource: 'debit',
            });
        });

        it('should map payment method with configuration', () => {
            const adyen = {
                type: 'paypal',
                name: 'PayPal',
                configuration: { intent: 'capture' },
            };

            const result = mapAdyenPaymentMethod(adyen);

            expect(result).toEqual({
                type: 'paypal',
                name: 'PayPal',
                configuration: { intent: 'capture' },
            });
        });

        it('should map payment method with all optional properties', () => {
            const adyen = {
                type: 'scheme',
                name: 'Credit Card',
                issuers: [{ id: '1', name: 'Bank' }],
                brands: ['visa'],
                funding_source: 'credit' as const,
                configuration: { someConfig: true },
            };

            const result = mapAdyenPaymentMethod(adyen);

            expect(result).toEqual({
                type: 'scheme',
                name: 'Credit Card',
                issuers: [{ id: '1', name: 'Bank' }],
                brands: ['visa'],
                fundingSource: 'credit',
                configuration: { someConfig: true },
            });
        });
    });

    describe('mapAdyenPaymentMethods', () => {
        it('should map multiple payment methods', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration(),
                options: [
                    {
                        name: 'Credit Card',
                        payment_method_variant: 'CARD',
                        payment_gateway_variant: 'ADYEN',
                        adyen: {
                            type: 'scheme',
                            name: 'Credit Card',
                        },
                    },
                    {
                        name: 'iDEAL',
                        payment_method_variant: 'ONLINE_BANKING',
                        payment_gateway_variant: 'ADYEN',
                        adyen: {
                            type: 'ideal',
                            name: 'iDEAL',
                        },
                    },
                ],
            };

            const result = mapAdyenPaymentMethods(paymentMethodOptionResponse);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                type: 'scheme',
                name: 'Credit Card',
            });
            expect(result[1]).toEqual({
                type: 'ideal',
                name: 'iDEAL',
            });
        });

        it('should return empty array when no options', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration(),
                options: [],
            };

            const result = mapAdyenPaymentMethods(paymentMethodOptionResponse);

            expect(result).toEqual([]);
        });
    });

    describe('createReturnUrl', () => {
        let originalLocation: Location;

        beforeEach(() => {
            // Save original location
            originalLocation = window.location;
            // Mock window.location.href using defineProperty
            Object.defineProperty(window, 'location', {
                writable: true,
                value: { ...window.location, href: 'https://example.com/checkout' },
            });
        });

        afterEach(() => {
            // Restore original location
            Object.defineProperty(window, 'location', {
                writable: true,
                value: originalLocation,
            });
        });

        it('should create return URL with payment acceptor ID', () => {
            const result = createReturnUrl({
                paymentAcceptorId: 'paya_123',
            });

            const url = new URL(result);
            expect(url.searchParams.get(PAYMENT_ACCEPTOR_ID_QUERY_STRING)).toBe('paya_123');
        });

        it('should use provided redirect URL', () => {
            const result = createReturnUrl({
                paymentAcceptorId: 'paya_123',
                redirectUrl: 'https://custom.com/payment',
            });

            const url = new URL(result);
            expect(url.origin).toBe('https://custom.com');
            expect(url.pathname).toBe('/payment');
            expect(url.searchParams.get(PAYMENT_ACCEPTOR_ID_QUERY_STRING)).toBe('paya_123');
        });

        it('should preserve existing query parameters', () => {
            const result = createReturnUrl({
                paymentAcceptorId: 'paya_123',
                redirectUrl: 'https://example.com/checkout?existing=param',
            });

            const url = new URL(result);
            expect(url.searchParams.get('existing')).toBe('param');
            expect(url.searchParams.get(PAYMENT_ACCEPTOR_ID_QUERY_STRING)).toBe('paya_123');
        });

        it('should override existing payment acceptor ID if present', () => {
            const result = createReturnUrl({
                paymentAcceptorId: 'paya_new',
                redirectUrl: 'https://example.com/checkout?payment_acceptor_id=paya_old',
            });

            const url = new URL(result);
            expect(url.searchParams.get(PAYMENT_ACCEPTOR_ID_QUERY_STRING)).toBe('paya_new');
        });
    });

    describe('getAdyenEnvironmentFromPaymentMethodOptionsResponse', () => {
        const noop = () => {};
        const noopLogger = { debug: noop, info: noop, warn: noop, error: noop, capture: noop };
        it('should return test for TEST environment', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                        adyen: {
                            environment: 'TEST',
                            public_key: 'test',
                            company_account: 'test',
                            merchant_accounts: [],
                            live_prefix: '',
                            ownership: 'PLATFORM',
                        },
                    },
                }),
                options: [],
            };

            const result = getAdyenEnvironmentFromPaymentMethodOptionsResponse(
                paymentMethodOptionResponse,
                noopLogger,
            );

            expect(result).toBe('test');
        });

        it('should return live for LIVE environment', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                        adyen: {
                            environment: 'LIVE',
                            public_key: 'test',
                            company_account: 'test',
                            merchant_accounts: [],
                            live_prefix: '',
                            ownership: 'PLATFORM',
                        },
                    },
                }),
                options: [],
            };

            const result = getAdyenEnvironmentFromPaymentMethodOptionsResponse(
                paymentMethodOptionResponse,
                noopLogger,
            );

            expect(result).toBe('live');
        });

        it('should return live-in for LIVE_IN environment', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                        adyen: {
                            environment: 'LIVE_IN',
                            public_key: 'test',
                            company_account: 'test',
                            merchant_accounts: [],
                            live_prefix: '',
                            ownership: 'PLATFORM',
                        },
                    },
                }),
                options: [],
            };

            const result = getAdyenEnvironmentFromPaymentMethodOptionsResponse(
                paymentMethodOptionResponse,
                noopLogger,
            );

            expect(result).toBe('live-in');
        });

        it('should return live-au for LIVE_AU environment', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                        adyen: {
                            environment: 'LIVE_AU',
                            public_key: 'test',
                            company_account: 'test',
                            merchant_accounts: [],
                            live_prefix: '',
                            ownership: 'PLATFORM',
                        },
                    },
                }),
                options: [],
            };

            const result = getAdyenEnvironmentFromPaymentMethodOptionsResponse(
                paymentMethodOptionResponse,
                noopLogger,
            );

            expect(result).toBe('live-au');
        });

        it('should return live-us for LIVE_US environment', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                        adyen: {
                            environment: 'LIVE_US',
                            public_key: 'test',
                            company_account: 'test',
                            merchant_accounts: [],
                            live_prefix: '',
                            ownership: 'PLATFORM',
                        },
                    },
                }),
                options: [],
            };

            const result = getAdyenEnvironmentFromPaymentMethodOptionsResponse(
                paymentMethodOptionResponse,
                noopLogger,
            );

            expect(result).toBe('live-us');
        });

        it('should return live-apse for LIVE_APSE environment', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                        adyen: {
                            environment: 'LIVE_APSE',
                            public_key: 'test',
                            company_account: 'test',
                            merchant_accounts: [],
                            live_prefix: '',
                            ownership: 'PLATFORM',
                        },
                    },
                }),
                options: [],
            };

            const result = getAdyenEnvironmentFromPaymentMethodOptionsResponse(
                paymentMethodOptionResponse,
                noopLogger,
            );

            expect(result).toBe('live-apse');
        });

        it('should default to live when environment is not set', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                        adyen: {
                            environment: 'LIVE',
                            public_key: 'test',
                            company_account: 'test',
                            merchant_accounts: [],
                            live_prefix: '',
                            ownership: 'PLATFORM',
                        },
                    },
                }),
                options: [],
            };

            const result = getAdyenEnvironmentFromPaymentMethodOptionsResponse(
                paymentMethodOptionResponse,
                noopLogger,
            );

            expect(result).toBe('live');
        });

        it('should default to live when paymentMethodOptionResponse is undefined', () => {
            const result = getAdyenEnvironmentFromPaymentMethodOptionsResponse(undefined, noopLogger);

            expect(result).toBe('live');
        });

        it('should default to live for unsupported environment', () => {
            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                        adyen: {
                            environment: 'UNSUPPORTED' as 'TEST' | 'LIVE',
                            public_key: 'test',
                            company_account: 'test',
                            merchant_accounts: [],
                            live_prefix: '',
                            ownership: 'PLATFORM',
                        },
                    },
                }),
                options: [],
            };

            const result = getAdyenEnvironmentFromPaymentMethodOptionsResponse(
                paymentMethodOptionResponse,
                noopLogger,
            );

            expect(result).toBe('live');
        });
    });

    describe('getAdyenExpressCheckoutConfiguration', () => {
        const noop = () => {};
        const noopLogger = { debug: noop, info: noop, warn: noop, error: noop, capture: noop };

        it('should return complete configuration', () => {
            const amount: Amount = {
                quantity: '10.50',
                currency: 'USD',
            };

            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                        adyen: {
                            public_key: 'test_key_123',
                            environment: 'TEST',
                            company_account: 'test',
                            merchant_accounts: [],
                            live_prefix: '',
                            ownership: 'PLATFORM',
                        },
                    },
                }),
                options: [
                    {
                        name: 'Credit Card',
                        payment_method_variant: 'CARD',
                        payment_gateway_variant: 'ADYEN',
                        adyen: {
                            type: 'scheme',
                            name: 'Credit Card',
                        },
                    },
                ],
            };

            const result = getAdyenExpressCheckoutConfiguration({
                amount,
                countryCode: 'US',
                locale: 'en-US',
                paymentMethodOptionResponse,
                logger: noopLogger,
            });

            expect(result).toEqual({
                amount: {
                    value: 1050,
                    currency: 'USD',
                },
                analytics: { enabled: false },
                clientKey: 'test_key_123',
                countryCode: 'US',
                environment: 'test',
                locale: 'en-US',
                paymentMethodsResponse: {
                    paymentMethods: [
                        {
                            type: 'scheme',
                            name: 'Credit Card',
                        },
                    ],
                },
            });
        });

        it('should handle missing client key', () => {
            const amount: Amount = {
                quantity: '10.50',
                currency: 'USD',
            };

            const paymentMethodOptionResponse: PaymentMethodOptionResponseEntry = {
                payment_acceptor: createMockPaymentAcceptor(),
                integration: createMockPaymentIntegration({
                    payment_gateway: {
                        variant: 'ADYEN',
                    },
                }),
                options: [],
            };

            const result = getAdyenExpressCheckoutConfiguration({
                amount,
                countryCode: 'US',
                locale: 'en-US',
                paymentMethodOptionResponse,
                logger: noopLogger,
            });

            expect(result.clientKey).toBeUndefined();
        });
    });

    describe('transformObjectToAdyenObject', () => {
        it('should transform object with string values', () => {
            const obj = {
                key1: 'value1',
                key2: 'value2',
            };

            const result = transformObjectToAdyenObject(obj);

            expect(result).toEqual({
                key1: 'value1',
                key2: 'value2',
            });
        });

        it('should transform object with number values to strings', () => {
            const obj = {
                amount: 100,
                quantity: 5,
            };

            const result = transformObjectToAdyenObject(obj);

            expect(result).toEqual({
                amount: '100',
                quantity: '5',
            });
        });

        it('should transform object with boolean values to strings', () => {
            const obj = {
                enabled: true,
                disabled: false,
            };

            const result = transformObjectToAdyenObject(obj);

            expect(result).toEqual({
                enabled: 'true',
                disabled: 'false',
            });
        });

        it('should transform object with null and undefined values to strings', () => {
            const obj = {
                nullValue: null,
                undefinedValue: undefined,
            };

            const result = transformObjectToAdyenObject(obj);

            expect(result).toEqual({
                nullValue: 'null',
                undefinedValue: 'undefined',
            });
        });

        it('should transform object with mixed types to strings', () => {
            const obj = {
                string: 'test',
                number: 123,
                boolean: true,
                nullValue: null,
                undefinedValue: undefined,
            };

            const result = transformObjectToAdyenObject(obj);

            expect(result).toEqual({
                string: 'test',
                number: '123',
                boolean: 'true',
                nullValue: 'null',
                undefinedValue: 'undefined',
            });
        });

        it('should return undefined when object is undefined', () => {
            const result = transformObjectToAdyenObject(undefined);

            expect(result).toBeUndefined();
        });

        it('should handle empty object', () => {
            const obj = {};

            const result = transformObjectToAdyenObject(obj);

            expect(result).toEqual({});
        });

        it('should transform object with array values to strings', () => {
            const obj = {
                items: [1, 2, 3],
            };

            const result = transformObjectToAdyenObject(obj);

            expect(result).toEqual({
                items: '1,2,3',
            });
        });

        it('should transform object with nested object values to strings', () => {
            const obj = {
                nested: { key: 'value' },
            };

            const result = transformObjectToAdyenObject(obj);

            expect(result).toEqual({
                nested: '[object Object]',
            });
        });
    });
});
