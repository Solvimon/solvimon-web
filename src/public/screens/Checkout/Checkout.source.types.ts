import type { Ref } from 'vue';
import type {
    Amount,
    AuthorizePaymentPayload,
    BillingPeriod,
    ConfiguredMeterValue,
    CountryCode,
    Invoice,
    PaymentMethodOptionsResponse,
    PricingPlanSubscriptionExpanded,
    TimePeriod,
} from '@solvimon/solvimon-types';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import type { useCheckoutForm } from '@/components/customer/CheckoutForm/useCheckoutForm';

/** `CHANGED`: the customer changed the order while the payment waited for its price. */
export type PriceSettlement = 'SETTLED' | 'CHANGED' | 'FAILED';

/** The promotion code the order is priced with, applied and removed by the flow. */
export interface CheckoutPromotionCode {
    /** Left out by a flow that always offers a code. */
    isAllowed?: Readonly<Ref<boolean>>;
    code: Ref<string | null>;
    isPending: Readonly<Ref<boolean>>;
    errorMessage: Ref<string | null>;
    apply: (code?: string | null) => void | Promise<void>;
    remove: () => void | Promise<void>;
}

/** How the order is paid for. */
export interface CheckoutPayment {
    paymentMethodOptions: Readonly<Ref<PaymentMethodOptionsResponse>>;
    isPaymentMethodsPending: Readonly<Ref<boolean>>;
    hasPaymentMethodOptionsError: Readonly<Ref<boolean>>;
    retryPaymentMethodOptions: () => void;
    authorizationContext: Readonly<Ref<AuthorizePaymentPayload['context'] | undefined>>;
    /** What an express payment sheet asks for when the customer picks another address. */
    updateInvoicePreviewOnBillingInformationChange: (
        formState: Partial<CheckoutFormState>,
    ) => Promise<{ trialInvoicePreview: Invoice; invoicePreview: Invoice }>;
}

/** Everything the checkout screen renders and pays from; each checkout flow supplies its own. */
export interface CheckoutSource {
    /** What the host configured, once anything unusable has been dropped and reported. */
    validatedEmail?: string;
    validatedCountry?: CountryCode;

    subscription: Readonly<Ref<PricingPlanSubscriptionExpanded | undefined>>;
    /** The order's own quantities: the editor's steppers may not go below them. */
    orderMeterValues: Readonly<
        Ref<{ seatsValues?: ConfiguredMeterValue[]; unitsValues?: ConfiguredMeterValue[] }>
    >;
    checkoutForm: ReturnType<typeof useCheckoutForm>;
    isShippingAddressRequired: boolean;

    invoicePreview: Readonly<Ref<Invoice | undefined>>;
    invoicePreviewByBillingPeriod: Readonly<Ref<Record<string, Invoice>>>;
    trialInvoicePreview: Readonly<Ref<Invoice | undefined>>;
    trialPeriod: Readonly<Ref<TimePeriod | undefined>>;
    isInvoicePreviewPending: Readonly<Ref<boolean>>;
    isInvoicePreviewStale: Readonly<Ref<boolean>>;
    settleInvoicePreview: () => Promise<PriceSettlement>;
    /** Left out only by a flow whose orders always have a single billing period. */
    changeBillingPeriod?: (billingPeriod: BillingPeriod) => void;

    amount: Readonly<Ref<Amount | undefined>>;
    recurringAmount: Readonly<Ref<Amount | undefined>>;
    hasOneOffCharges: Readonly<Ref<boolean>>;

    promotionCode: CheckoutPromotionCode;

    /** Left out by a flow that cannot take a payment yet: Pay stays disabled. */
    payment?: CheckoutPayment;
    /** Whether the flow has all it needs to be paid; left out when only the form decides. */
    canPay?: Readonly<Ref<boolean>>;
    isPaid: Ref<boolean>;

    successUrl: Readonly<Ref<string | undefined>>;
    /** Markdown shown with the pay button. */
    note: Readonly<Ref<string | undefined>>;

    /** Absent when the flow keeps its state elsewhere and has no form to restore after a redirect. */
    saveFormStateForRedirect?: () => void;
    clearSavedFormState?: () => void;
}
