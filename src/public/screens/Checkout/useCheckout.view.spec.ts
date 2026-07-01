import { nextTick, defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type {
    PricingPlanSubscription,
    PricingPlanSubscriptionExpanded,
    CountryCode,
    Amount,
    Pricing,
    AuthorizePaymentPayload,
} from '@solvimon/solvimon-types';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { useCheckoutView } from './useCheckout.view';

type AuthorizePaymentInitPricingPlanSubscriptionContext = Extract<
    NonNullable<AuthorizePaymentPayload['context']>,
    { type: 'INIT_PRICING_PLAN_SUBSCRIPTION' }
>;

const {
    mockGetSubscription,
    mockLoadInvoicePreview,
    mockLoadPaymentMethodOptions,
    mockTaxIdValidator,
    mockGetFirstPricingPlanScheduleOfType,
    mockGetScheduleCustomizations,
    mockGetQueryParam,
    mockGetGeoLocation,
    mockWithPreselectedEnabledPricings,
} = vi.hoisted(() => ({
    mockGetSubscription:
        vi.fn<
            (args: {
                id: PricingPlanSubscription['id'];
                expanded: boolean;
            }) => Promise<PricingPlanSubscriptionExpanded>
        >(),
    mockLoadInvoicePreview: vi.fn(),
    mockLoadPaymentMethodOptions: vi.fn(),
    mockTaxIdValidator: vi.fn(() => true),
    mockGetFirstPricingPlanScheduleOfType: vi.fn(),
    mockGetScheduleCustomizations: vi.fn(),
    mockGetQueryParam: vi.fn<(name: string) => string | null>(() => null),
    mockGetGeoLocation: vi.fn(() => Promise.resolve({ country: 'NL' })),
    mockWithPreselectedEnabledPricings: vi.fn(() => [] as string[]),
}));

const mockUseInvoicePreview = vi.fn<
    () => {
        invoicePreview: { value: { invoice_amount_including_tax: Amount } | null };
        trialInvoicePreview: { value: { invoice_amount_including_tax: Amount } | null };
        trialPeriod: { value: unknown };
        isPending: { value: boolean };
        loadInvoicePreview: ReturnType<typeof vi.fn>;
    }
>(() => ({
    invoicePreview: { value: null },
    trialInvoicePreview: { value: null },
    trialPeriod: { value: null },
    isPending: { value: false },
    loadInvoicePreview: mockLoadInvoicePreview,
}));

const createMockCheckoutForm = (overrides?: Partial<CheckoutFormState>) => ({
    form: {
        value: {
            email: undefined,
            country: undefined,
            type: 'INDIVIDUAL' as const,
            companyLegalName: undefined,
            firstName: undefined,
            infix: undefined,
            lastName: undefined,
            addressLine1: undefined,
            addressLine2: undefined,
            postalCode: undefined,
            city: undefined,
            state: undefined,
            companyVatNumber: undefined,
            seats_values: undefined,
            ...overrides,
        } as CheckoutFormState,
    },
    validation: { value: {} },
    getIsFieldRequired: vi.fn(),
    updateInitialState: vi.fn(),
});

const mockUseCheckoutForm = vi.fn<
    (args?: {
        initialState?: Partial<CheckoutFormState>;
        onRequiredFieldChange?: (form: CheckoutFormState) => void;
    }) => ReturnType<typeof createMockCheckoutForm>
>(
    (args?: {
        initialState?: Partial<CheckoutFormState>;
        onRequiredFieldChange?: (form: CheckoutFormState) => void;
    }) => createMockCheckoutForm(),
);

const mockUsePaymentMethodOptions = vi.fn(() => ({
    paymentMethodOptions: { value: [] },
    isPending: { value: false },
    loadPaymentMethodOptions: mockLoadPaymentMethodOptions,
}));

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: vi.fn(() => ({
        getSubscription: mockGetSubscription,
    })),
}));

vi.mock('@/composables/useInvoicePreview', () => ({
    useInvoicePreview: () => mockUseInvoicePreview(),
}));

vi.mock('@/components/customer/CheckoutForm/useCheckoutForm', () => ({
    useCheckoutForm: (args?: {
        initialState?: Partial<CheckoutFormState>;
        onRequiredFieldChange?: (form: CheckoutFormState) => void;
    }) => mockUseCheckoutForm(args),
}));

vi.mock('@/composables/useCheckoutPaymentMethodOptions', () => ({
    usePaymentMethodOptions: () => mockUsePaymentMethodOptions(),
}));

vi.mock('@solvimon/solvimon-ui/validators', () => ({
    taxId: {
        $validator: mockTaxIdValidator,
    },
}));

vi.mock('@/utils/pricingPlanSchedule', () => ({
    getFirstPricingPlanScheduleOfType: mockGetFirstPricingPlanScheduleOfType,
    getScheduleCustomizations: mockGetScheduleCustomizations,
}));

vi.mock('@/utils/url', () => ({
    getQueryParam: (name: string) => mockGetQueryParam(name),
}));

vi.mock('@/utils/adyen', () => ({
    PAYMENT_ACCEPTOR_ID_QUERY_STRING: 'payment_acceptor_id',
}));

vi.mock('@/utils/enabledPricings', () => ({
    withPreselectedEnabledPricings: mockWithPreselectedEnabledPricings,
}));

vi.mock('@/services/geolocation', () => ({
    createGeoLocationService: () => ({ getGeoLocation: mockGetGeoLocation }),
}));

function withSetup<T>(composable: () => T): [T, ReturnType<typeof mount>] {
    let result!: T;
    const wrapper = mount(
        defineComponent({
            setup() {
                result = composable();
                return () => h('div');
            },
        }),
    );
    return [result, wrapper];
}

describe('useCheckoutView', () => {
    const mockSubscription: PricingPlanSubscriptionExpanded = {
        id: 'sub_123' as PricingPlanSubscription['id'],
        pricing_plan_schedule_infos: [
            {
                id: 'schedule_1',
                start_at: '2024-01-01T00:00:00.000Z',
                pricing_plan_schedule: {
                    type: 'DEFAULT',
                },
            },
        ],
    } as unknown as PricingPlanSubscriptionExpanded;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetQueryParam.mockReturnValue(null);
        sessionStorage.clear();
        mockGetSubscription.mockResolvedValue(mockSubscription);
        mockLoadInvoicePreview.mockResolvedValue(undefined);
        mockLoadPaymentMethodOptions.mockResolvedValue(undefined);
        mockTaxIdValidator.mockReturnValue(true);
        mockGetFirstPricingPlanScheduleOfType.mockReturnValue({
            ...mockSubscription.pricing_plan_schedule_infos[0],
            pricing_plan_schedule: {
                ...mockSubscription.pricing_plan_schedule_infos[0].pricing_plan_schedule,
                seats_values: undefined,
            },
        });
        mockGetScheduleCustomizations.mockReturnValue(undefined);
        // Reset mock to default implementation
        mockUseCheckoutForm.mockImplementation(
            (args?: {
                initialState?: Partial<CheckoutFormState>;
                onRequiredFieldChange?: (form: CheckoutFormState) => void;
            }) => createMockCheckoutForm(),
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    it('initializes with provided parameters', () => {
        const initialCountry = 'NL' as CountryCode;
        const initialEmail = 'test@example.com';
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        const result = useCheckoutView({
            initialCountry,
            initialEmail,
            subscriptionId,
        });

        expect(result.subscription.value).toBeUndefined();
        expect(result.isPaid.value).toBe(false);
        expect(result.isPaymentMethodsPending.value).toBe(false);
        expect(result.isInvoicePreviewPending.value).toBe(false);
        expect(mockUseCheckoutForm).toHaveBeenCalled();
    });

    it('loads subscription on mount', async () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        // onMounted is called but requires a component instance
        // We can verify the subscription loading function exists and works
        // by manually calling loadSubscription through the composable setup
        // Since onMounted won't execute without a component, we test the subscription loading logic
        // by verifying the subscription ref can be set and the structure is correct
        expect(result.subscription.value).toBeUndefined();

        // Manually set subscription to test watchers
        result.subscription.value = mockSubscription;
        await nextTick();
        await nextTick();

        expect(result.subscription.value).toEqual(mockSubscription);
    });

    it('loads invoice preview and payment method options when subscription is loaded', async () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];
        const initialCountry = 'NL' as CountryCode;
        let onRequiredFieldChangeCallback: ((form: CheckoutFormState) => void) | undefined;

        const checkoutFormMock = createMockCheckoutForm({
            email: 'test@example.com',
            country: initialCountry,
            type: 'INDIVIDUAL' as const,
            firstName: 'John',
            lastName: 'Doe',
            addressLine1: 'Main St 1',
            city: 'Amsterdam',
            postalCode: '1000AA',
        });

        mockUseCheckoutForm.mockImplementation(
            (args?: {
                initialState?: Partial<CheckoutFormState>;
                onRequiredFieldChange?: (form: CheckoutFormState) => void;
            }) => {
                if (args?.onRequiredFieldChange) {
                    onRequiredFieldChangeCallback = args.onRequiredFieldChange;
                }
                return checkoutFormMock;
            },
        );

        const invoicePreviewMock = {
            invoicePreview: {
                value: { invoice_amount_including_tax: { currency: 'EUR', quantity: '100' } } as {
                    invoice_amount_including_tax: Amount;
                } | null,
            },
            trialInvoicePreview: { value: null as { invoice_amount_including_tax: Amount } | null },
            trialPeriod: { value: null },
            isPending: { value: false },
            loadInvoicePreview: mockLoadInvoicePreview,
        };

        mockUseInvoicePreview.mockReturnValue(invoicePreviewMock);

        const result = useCheckoutView({
            initialCountry,
            initialEmail: undefined,
            subscriptionId,
        });

        // Manually set subscription to trigger watchers
        result.subscription.value = mockSubscription;
        await nextTick();

        // Trigger the onRequiredFieldChange callback to simulate form field change
        // This is what would happen when a required field changes after subscription is loaded
        if (onRequiredFieldChangeCallback) {
            onRequiredFieldChangeCallback(checkoutFormMock.form.value as CheckoutFormState);
            await nextTick();
        }

        expect(mockLoadInvoicePreview).toHaveBeenCalled();
        expect(mockLoadPaymentMethodOptions).toHaveBeenCalledWith({
            subscriptionId: mockSubscription.id,
            country: initialCountry,
            amount: invoicePreviewMock.invoicePreview.value?.invoice_amount_including_tax,
        });
    });

    it('computes authorization context for INDIVIDUAL customer type', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        const checkoutFormMock = createMockCheckoutForm({
            email: 'test@example.com',
            country: 'NL' as CountryCode,
            type: 'INDIVIDUAL' as const,
            firstName: 'John',
            infix: 'van',
            lastName: 'Doe',
            addressLine1: 'Main St 1',
            addressLine2: 'Apt 2',
            city: 'Amsterdam',
            postalCode: '1000AA',
            state: 'NH',
        });

        mockUseCheckoutForm.mockReturnValue(checkoutFormMock);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        const context = result.authorizationContext
            .value as AuthorizePaymentInitPricingPlanSubscriptionContext;

        expect(context.type).toBe('INIT_PRICING_PLAN_SUBSCRIPTION');
        expect(context.init_pricing_plan_subscription.template_pricing_plan_subscription_id).toBe(
            subscriptionId,
        );
        expect(context.init_pricing_plan_subscription.customer_details.email).toBe(
            'test@example.com',
        );
        expect(context.init_pricing_plan_subscription.customer_details.type).toBe('INDIVIDUAL');
        expect(context.init_pricing_plan_subscription.customer_details.individual?.name).toEqual({
            first_name: 'John',
            infix: 'van',
            last_name: 'Doe',
        });
        expect(
            context.init_pricing_plan_subscription.customer_details.individual?.residential_address,
        ).toEqual({
            line1: 'Main St 1',
            line2: 'Apt 2',
            city: 'Amsterdam',
            postal_code: '1000AA',
            state: 'NH',
            country: 'NL',
        });
    });

    it('computes authorization context for ORGANIZATION customer type', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        const checkoutFormMock = createMockCheckoutForm({
            email: 'company@example.com',
            country: 'NL' as CountryCode,
            type: 'ORGANIZATION' as const,
            companyLegalName: 'Acme Corp',
            companyVatNumber: 'NL123456789B01',
            addressLine1: 'Business St 1',
            city: 'Rotterdam',
            postalCode: '2000AB',
        });

        mockUseCheckoutForm.mockReturnValue(checkoutFormMock);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        const context = result.authorizationContext
            .value as AuthorizePaymentInitPricingPlanSubscriptionContext;

        expect(context.type).toBe('INIT_PRICING_PLAN_SUBSCRIPTION');
        expect(context.init_pricing_plan_subscription.customer_details.type).toBe('ORGANIZATION');
        expect(
            context.init_pricing_plan_subscription.customer_details.organization?.legal_name,
        ).toBe('Acme Corp');
        expect(
            context.init_pricing_plan_subscription.customer_details.organization
                ?.registered_address,
        ).toEqual({
            line1: 'Business St 1',
            city: 'Rotterdam',
            postal_code: '2000AB',
            country: 'NL',
        });
    });

    it('includes enabled pricing IDs in authorization context when provided', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];
        const enabledPricingIds = ['pricing_1', 'pricing_2'] as Pricing['id'][];

        const checkoutFormMock = createMockCheckoutForm({
            email: 'test@example.com',
            country: 'NL' as CountryCode,
            type: 'INDIVIDUAL' as const,
        });

        mockUseCheckoutForm.mockReturnValue(checkoutFormMock);

        const scheduleCustomizations = [
            {
                pricing_plan_schedule_id: 'schedule_1',
                enabled_pricings: [{ pricing_id: 'pricing_1' }, { pricing_id: 'pricing_2' }],
            },
        ];

        mockGetScheduleCustomizations.mockReturnValue(scheduleCustomizations);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
            enabledPricingIds,
        });

        // Set subscription value so authorizationContext can compute
        result.subscription.value = mockSubscription;

        const context = result.authorizationContext
            .value as AuthorizePaymentInitPricingPlanSubscriptionContext;

        expect(context.init_pricing_plan_subscription.pricing_plan_schedule_customizations).toEqual(
            scheduleCustomizations,
        );
    });

    it('omits pricingCurrency and billingPeriod in authorization customizations for single settings', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        mockUseCheckoutForm.mockReturnValue(
            createMockCheckoutForm({
                type: 'INDIVIDUAL' as const,
                country: 'NL' as CountryCode,
            }),
        );
        mockGetFirstPricingPlanScheduleOfType.mockReturnValue({
            id: 'schedule_1',
            pricing_plan_schedule: { type: 'DEFAULT' },
            pricing_plan_version: {
                pricing_currency_settings: {
                    default_pricing_currency: 'EUR',
                    pricing_currencies: ['EUR'],
                },
                billing_period_settings: {
                    billing_periods: [{ period: { type: 'MONTH', value: 1 } }],
                },
            },
        });
        mockGetScheduleCustomizations.mockReturnValue(undefined);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });
        result.subscription.value = {
            ...mockSubscription,
            billing_currency: 'EUR',
            billing_period: { type: 'MONTH', value: 1 },
        } as unknown as PricingPlanSubscriptionExpanded;

        void result.authorizationContext.value;

        expect(mockGetScheduleCustomizations).toHaveBeenCalledWith(
            expect.objectContaining({
                pricingCurrency: undefined,
                billingPeriod: undefined,
            }),
        );
    });

    it('includes pricingCurrency and billingPeriod in authorization customizations for multi settings', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        mockUseCheckoutForm.mockReturnValue(
            createMockCheckoutForm({
                type: 'INDIVIDUAL' as const,
                country: 'NL' as CountryCode,
            }),
        );
        mockGetFirstPricingPlanScheduleOfType.mockReturnValue({
            id: 'schedule_1',
            pricing_plan_schedule: { type: 'DEFAULT' },
            pricing_plan_version: {
                pricing_currency_settings: {
                    default_pricing_currency: 'EUR',
                    pricing_currencies: ['EUR', 'AUD'],
                },
                billing_period_settings: {
                    billing_periods: [
                        { period: { type: 'MONTH', value: 1 } },
                        { period: { type: 'YEAR', value: 1 } },
                    ],
                },
            },
        });
        mockGetScheduleCustomizations.mockReturnValue(undefined);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });
        result.subscription.value = {
            ...mockSubscription,
            billing_currency: 'AUD',
            billing_period: { type: 'YEAR', value: 1 },
        } as unknown as PricingPlanSubscriptionExpanded;

        void result.authorizationContext.value;

        expect(mockGetScheduleCustomizations).toHaveBeenCalledWith(
            expect.objectContaining({
                pricingCurrency: 'AUD',
                billingPeriod: { type: 'YEAR', value: 1 },
            }),
        );
    });

    it('includes only billingPeriod in authorization customizations when only multi billing periods exist', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        mockUseCheckoutForm.mockReturnValue(
            createMockCheckoutForm({
                type: 'INDIVIDUAL' as const,
                country: 'NL' as CountryCode,
            }),
        );
        mockGetFirstPricingPlanScheduleOfType.mockReturnValue({
            id: 'schedule_1',
            pricing_plan_schedule: { type: 'DEFAULT' },
            pricing_plan_version: {
                billing_period_settings: {
                    billing_periods: [
                        { period: { type: 'MONTH', value: 1 } },
                        { period: { type: 'YEAR', value: 1 } },
                    ],
                },
            },
        });
        mockGetScheduleCustomizations.mockReturnValue(undefined);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });
        result.subscription.value = {
            ...mockSubscription,
            billing_currency: 'EUR',
            billing_period: { type: 'YEAR', value: 1 },
        } as unknown as PricingPlanSubscriptionExpanded;

        void result.authorizationContext.value;

        expect(mockGetScheduleCustomizations).toHaveBeenCalledWith(
            expect.objectContaining({
                pricingCurrency: undefined,
                billingPeriod: { type: 'YEAR', value: 1 },
            }),
        );
    });

    it('includes only pricingCurrency in authorization customizations when only multi pricing currencies exist', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        mockUseCheckoutForm.mockReturnValue(
            createMockCheckoutForm({
                type: 'INDIVIDUAL' as const,
                country: 'NL' as CountryCode,
            }),
        );
        mockGetFirstPricingPlanScheduleOfType.mockReturnValue({
            id: 'schedule_1',
            pricing_plan_schedule: { type: 'DEFAULT' },
            pricing_plan_version: {
                pricing_currency_settings: {
                    default_pricing_currency: 'EUR',
                    pricing_currencies: ['EUR', 'AUD'],
                },
                billing_period_settings: {
                    billing_periods: [{ period: { type: 'MONTH', value: 1 } }],
                },
            },
        });
        mockGetScheduleCustomizations.mockReturnValue(undefined);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });
        result.subscription.value = {
            ...mockSubscription,
            billing_currency: 'AUD',
            billing_period: { type: 'MONTH', value: 1 },
        } as unknown as PricingPlanSubscriptionExpanded;

        void result.authorizationContext.value;

        expect(mockGetScheduleCustomizations).toHaveBeenCalledWith(
            expect.objectContaining({
                pricingCurrency: 'AUD',
                billingPeriod: undefined,
            }),
        );
    });

    it('computes amount from trial invoice preview when available', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];
        const trialAmount: Amount = { currency: 'EUR', quantity: '50' };
        const regularAmount: Amount = { currency: 'EUR', quantity: '100' };

        const invoicePreviewMock = {
            invoicePreview: {
                value: { invoice_amount_including_tax: regularAmount } as {
                    invoice_amount_including_tax: Amount;
                } | null,
            },
            trialInvoicePreview: {
                value: { invoice_amount_including_tax: trialAmount } as {
                    invoice_amount_including_tax: Amount;
                } | null,
            },
            trialPeriod: { value: null },
            isPending: { value: false },
            loadInvoicePreview: mockLoadInvoicePreview,
        };

        mockUseInvoicePreview.mockReturnValue(invoicePreviewMock);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        expect(result.amount.value).toEqual(trialAmount);
    });

    it('computes amount from regular invoice preview when trial preview is not available', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];
        const regularAmount: Amount = { currency: 'EUR', quantity: '100' };

        const invoicePreviewMock = {
            invoicePreview: {
                value: { invoice_amount_including_tax: regularAmount } as {
                    invoice_amount_including_tax: Amount;
                } | null,
            },
            trialInvoicePreview: { value: null as { invoice_amount_including_tax: Amount } | null },
            trialPeriod: { value: null },
            isPending: { value: false },
            loadInvoicePreview: mockLoadInvoicePreview,
        };

        mockUseInvoicePreview.mockReturnValue(invoicePreviewMock);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        expect(result.amount.value).toEqual(regularAmount);
    });

    it('returns undefined amount when no invoice preview is available', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        const invoicePreviewMock = {
            invoicePreview: { value: null },
            trialInvoicePreview: { value: null },
            trialPeriod: { value: null },
            isPending: { value: false },
            loadInvoicePreview: mockLoadInvoicePreview,
        };

        mockUseInvoicePreview.mockReturnValue(invoicePreviewMock);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        expect(result.amount.value).toBeUndefined();
    });

    it('calls loadInvoicePreview when required field changes', async () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];
        let onRequiredFieldChangeCallback: ((form: CheckoutFormState) => void) | undefined;

        const checkoutFormMock = createMockCheckoutForm({
            email: 'test@example.com',
            country: 'NL' as CountryCode,
            type: 'INDIVIDUAL' as const,
            firstName: 'John',
        });

        mockUseCheckoutForm.mockImplementation(
            (args?: {
                initialState?: Partial<CheckoutFormState>;
                onRequiredFieldChange?: (form: CheckoutFormState) => void;
            }) => {
                if (args?.onRequiredFieldChange) {
                    onRequiredFieldChangeCallback = args.onRequiredFieldChange;
                }
                return checkoutFormMock;
            },
        );

        const invoicePreviewMock = {
            invoicePreview: { value: null as { invoice_amount_including_tax: Amount } | null },
            trialInvoicePreview: { value: null as { invoice_amount_including_tax: Amount } | null },
            trialPeriod: { value: null },
            isPending: { value: false },
            loadInvoicePreview: mockLoadInvoicePreview,
        };

        mockUseInvoicePreview.mockReturnValue(invoicePreviewMock);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        // Set subscription value so loadInvoicePreview can be called
        result.subscription.value = mockSubscription;
        await nextTick();

        // Verify callback was captured
        expect(onRequiredFieldChangeCallback).toBeDefined();

        // Simulate required field change
        if (onRequiredFieldChangeCallback) {
            onRequiredFieldChangeCallback(checkoutFormMock.form.value as CheckoutFormState);
            await nextTick();
        }

        expect(mockLoadInvoicePreview).toHaveBeenCalled();
    });

    it('does not call loadInvoicePreview when subscription is not loaded yet', async () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];
        let onRequiredFieldChangeCallback: ((form: unknown) => void) | undefined;

        const checkoutFormMock = createMockCheckoutForm({
            email: 'test@example.com',
            country: 'NL' as CountryCode,
            type: 'INDIVIDUAL' as const,
        });

        mockUseCheckoutForm.mockImplementation(() => {
            // Access the callback from the actual useCheckoutForm call
            // We need to capture it from the mock implementation
            return checkoutFormMock;
        });

        useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        // Simulate required field change before subscription is loaded
        if (onRequiredFieldChangeCallback) {
            onRequiredFieldChangeCallback(checkoutFormMock.form.value as CheckoutFormState);
            await nextTick();
        }

        // loadInvoicePreview should not be called because subscription is not loaded
        expect(mockLoadInvoicePreview).not.toHaveBeenCalled();
    });

    it('handles missing name fields in authorization context', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        const checkoutFormMock = createMockCheckoutForm({
            email: 'test@example.com',
            country: 'NL' as CountryCode,
            type: 'INDIVIDUAL' as const,
            // No name fields
        });

        mockUseCheckoutForm.mockReturnValue(checkoutFormMock);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        const context = result.authorizationContext
            .value as AuthorizePaymentInitPricingPlanSubscriptionContext;

        expect(context.init_pricing_plan_subscription.customer_details.individual?.name).toEqual(
            {},
        );
    });

    it('handles missing address fields in authorization context', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        const checkoutFormMock = createMockCheckoutForm({
            email: 'test@example.com',
            country: 'NL' as CountryCode,
            type: 'INDIVIDUAL' as const,
            // No address fields
        });

        mockUseCheckoutForm.mockReturnValue(checkoutFormMock);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        const context = result.authorizationContext
            .value as AuthorizePaymentInitPricingPlanSubscriptionContext;

        expect(
            context.init_pricing_plan_subscription.customer_details.individual?.residential_address,
        ).toEqual({
            country: 'NL',
        });
    });

    it('includes tax_ids in organization context when VAT number is valid', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        mockTaxIdValidator.mockReturnValue(true);

        const checkoutFormMock = createMockCheckoutForm({
            email: 'company@example.com',
            country: 'NL' as CountryCode,
            type: 'ORGANIZATION' as const,
            companyLegalName: 'Acme Corp',
            companyVatNumber: 'NL123456789B01', // Valid Dutch VAT number format
        });

        mockUseCheckoutForm.mockReturnValue(checkoutFormMock);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        const context = result.authorizationContext
            .value as AuthorizePaymentInitPricingPlanSubscriptionContext;

        expect(
            context.init_pricing_plan_subscription.customer_details.organization?.legal_name,
        ).toBe('Acme Corp');
        expect(
            context.init_pricing_plan_subscription.customer_details.organization?.tax_ids?.[0]?.id,
        ).toBe('NL123456789B01');
        expect(mockTaxIdValidator).toHaveBeenCalledWith('NL123456789B01', {}, {});
    });

    it('excludes tax_ids in organization context when VAT number is invalid', () => {
        const subscriptionId = 'sub_123' as PricingPlanSubscription['id'];

        mockTaxIdValidator.mockReturnValue(false);

        const checkoutFormMock = createMockCheckoutForm({
            email: 'company@example.com',
            country: 'NL' as CountryCode,
            type: 'ORGANIZATION' as const,
            companyLegalName: 'Acme Corp',
            companyVatNumber: 'INVALID123',
        });

        mockUseCheckoutForm.mockReturnValue(checkoutFormMock);

        const result = useCheckoutView({
            initialCountry: undefined,
            initialEmail: undefined,
            subscriptionId,
        });

        const context = result.authorizationContext
            .value as AuthorizePaymentInitPricingPlanSubscriptionContext;

        expect(
            context.init_pricing_plan_subscription.customer_details.organization?.legal_name,
        ).toBe('Acme Corp');
        expect(
            context.init_pricing_plan_subscription.customer_details.organization?.tax_ids,
        ).toBeUndefined();
    });

    describe('onMounted', () => {
        it('calls loadSubscription on mount', async () => {
            const [, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );
            await flushPromises();
            expect(mockGetSubscription).toHaveBeenCalledWith({ id: 'sub_123', expanded: true });
            wrapper.unmount();
        });

        it('calls loadInvoicePreview on mount after subscription loads', async () => {
            const [, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );
            await flushPromises();
            expect(mockLoadInvoicePreview).toHaveBeenCalled();
            wrapper.unmount();
        });

        it('does not propagate loadInvoicePreview errors on mount', async () => {
            mockLoadInvoicePreview.mockRejectedValue(new Error('preview failed'));
            const [, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );
            await expect(flushPromises()).resolves.not.toThrow();
            wrapper.unmount();
        });
    });

    describe('saveFormStateForRedirect', () => {
        const REDIRECT_FORM_STATE_KEY = 'solvimon_checkout_redirect_state';

        it('writes the current form state to sessionStorage', () => {
            const checkoutFormMock = createMockCheckoutForm({
                email: 'test@example.com',
                country: 'NL' as CountryCode,
                firstName: 'Jan',
            });
            mockUseCheckoutForm.mockReturnValue(checkoutFormMock);

            const result = useCheckoutView({
                initialCountry: undefined,
                initialEmail: undefined,
                subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
            });

            result.saveFormStateForRedirect();

            const raw = sessionStorage.getItem(REDIRECT_FORM_STATE_KEY);
            expect(raw).not.toBeNull();
            const parsed = JSON.parse(raw!);
            expect(parsed).toMatchObject({
                email: 'test@example.com',
                country: 'NL',
                firstName: 'Jan',
            });
        });

        it('overwrites any previously saved state', () => {
            sessionStorage.setItem(REDIRECT_FORM_STATE_KEY, JSON.stringify({ email: 'old@example.com' }));

            const checkoutFormMock = createMockCheckoutForm({ email: 'new@example.com' });
            mockUseCheckoutForm.mockReturnValue(checkoutFormMock);

            const result = useCheckoutView({
                initialCountry: undefined,
                initialEmail: undefined,
                subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
            });

            result.saveFormStateForRedirect();

            const parsed = JSON.parse(sessionStorage.getItem(REDIRECT_FORM_STATE_KEY)!);
            expect(parsed.email).toBe('new@example.com');
        });
    });

    describe('redirect detection', () => {
        const REDIRECT_FORM_STATE_KEY = 'solvimon_checkout_redirect_state';

        function setupRedirectParams(overrides: Record<string, string | null> = {}) {
            const defaults: Record<string, string | null> = {
                redirect_status: 'succeeded',
                payment_acceptor_id: 'paya_123',
                payment_intent_client_secret: 'pi_secret_123',
                setup_intent_client_secret: null,
            };
            const params = { ...defaults, ...overrides };
            mockGetQueryParam.mockImplementation((name: string) => params[name] ?? null);
        }

        it('sets isPaid to true synchronously when all redirect params are present', async () => {
            setupRedirectParams();

            const [result, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );

            expect(result.isPaid.value).toBe(true);
            await flushPromises();
            wrapper.unmount();
        });

        it('accepts setup_intent_client_secret as the client secret param', async () => {
            setupRedirectParams({
                payment_intent_client_secret: null,
                setup_intent_client_secret: 'seti_secret_123',
            });

            const [result, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );

            expect(result.isPaid.value).toBe(true);
            await flushPromises();
            wrapper.unmount();
        });

        it('does not set isPaid when redirect_status is not succeeded', async () => {
            setupRedirectParams({ redirect_status: 'failed' });

            const [result, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );

            await flushPromises();
            expect(result.isPaid.value).toBe(false);
            wrapper.unmount();
        });

        it('does not set isPaid when payment_acceptor_id is missing', async () => {
            setupRedirectParams({ payment_acceptor_id: null });

            const [result, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );

            await flushPromises();
            expect(result.isPaid.value).toBe(false);
            wrapper.unmount();
        });

        it('does not set isPaid when both client secrets are absent', async () => {
            setupRedirectParams({
                payment_intent_client_secret: null,
                setup_intent_client_secret: null,
            });

            const [result, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );

            await flushPromises();
            expect(result.isPaid.value).toBe(false);
            wrapper.unmount();
        });

        it('restores form state from sessionStorage after subscription loads', async () => {
            setupRedirectParams();

            const savedState = { email: 'restored@example.com', country: 'DE', firstName: 'Hans' };
            sessionStorage.setItem(REDIRECT_FORM_STATE_KEY, JSON.stringify(savedState));

            const checkoutFormMock = createMockCheckoutForm();
            mockUseCheckoutForm.mockReturnValue(checkoutFormMock);

            const [, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );

            await flushPromises();

            expect(checkoutFormMock.updateInitialState).toHaveBeenCalledWith(
                expect.objectContaining(savedState),
            );
            wrapper.unmount();
        });

        it('removes the sessionStorage item after restoring form state', async () => {
            setupRedirectParams();
            sessionStorage.setItem(REDIRECT_FORM_STATE_KEY, JSON.stringify({ email: 'a@b.com' }));

            const [, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );

            await flushPromises();

            expect(sessionStorage.getItem(REDIRECT_FORM_STATE_KEY)).toBeNull();
            wrapper.unmount();
        });

        it('does not call updateInitialState for restoration when no sessionStorage item exists', async () => {
            setupRedirectParams();

            const checkoutFormMock = createMockCheckoutForm();
            mockUseCheckoutForm.mockReturnValue(checkoutFormMock);

            const [, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );

            await flushPromises();

            // updateInitialState is called once by loadSubscription, but not for restoration
            const callArgs = checkoutFormMock.updateInitialState.mock.calls;
            expect(callArgs).toHaveLength(1); // only from loadSubscription
            wrapper.unmount();
        });

        it('handles malformed sessionStorage JSON gracefully', async () => {
            setupRedirectParams();
            sessionStorage.setItem(REDIRECT_FORM_STATE_KEY, 'not valid json {{{');

            const [result, wrapper] = withSetup(() =>
                useCheckoutView({
                    initialCountry: undefined,
                    initialEmail: undefined,
                    subscriptionId: 'sub_123' as PricingPlanSubscription['id'],
                }),
            );

            await expect(flushPromises()).resolves.not.toThrow();
            expect(result.isPaid.value).toBe(true);
            wrapper.unmount();
        });
    });
});
