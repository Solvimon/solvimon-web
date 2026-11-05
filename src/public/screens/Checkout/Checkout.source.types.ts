import type { Ref } from 'vue';
import type {
    Amount,
    BillingPeriod,
    ConfiguredMeterValue,
    CountryCode,
    Invoice,
    PaymentMethodOptionsResponse,
    PricingPlanSubscriptionExpanded,
    TimePeriod,
} from '@solvimon/solvimon-types';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import type { CheckoutFormDisplay } from '@/components/customer/CheckoutForm/CheckoutForm.lib';
import type { useCheckoutForm } from '@/components/customer/CheckoutForm/useCheckoutForm';
import type { PaymentAuthorizationContext } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

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
    authorizationContext: Readonly<Ref<PaymentAuthorizationContext | undefined>>;
    /**
     * The country the payment methods are set up for when the flow knows it apart from the form,
     * such as that of a customer who already exists. The form's own country goes first.
     */
    countryCode?: Readonly<Ref<string | undefined>>;
    /**
     * What an express payment sheet asks for when the customer picks another address. Left out by a
     * flow that offers no express payment.
     */
    updateInvoicePreviewOnBillingInformationChange?: (
        formState: Partial<CheckoutFormState>,
    ) => Promise<{ trialInvoicePreview: Invoice; invoicePreview: Invoice }>;
    /**
     * Given by a flow that finishes the order itself once the payment is authorized: the screen
     * keeps waiting on it rather than marking the order paid and redirecting.
     */
    awaitCompletion?: () => void;
    /**
     * What the flow makes of a failed payment: `PRICE_CHANGED` when it re-priced the order to be
     * paid again.
     */
    recoverPaymentFailure?: (
        failure: { error?: unknown; apiError?: unknown } | undefined,
    ) => PaymentRecovery | undefined;
}

export type PaymentRecovery = 'PRICE_CHANGED';

/** The form of one customer of the order. */
export interface CheckoutCustomerForm {
    key: string;
    form: ReturnType<typeof useCheckoutForm>;
    display?: CheckoutFormDisplay;
    isTypeLocked?: boolean;
    /** Names the section when the order has several customers. */
    title?: string;
}

/** The quantities of one subscription of the order, and the promotion code it takes. */
export interface CheckoutPlanCustomization {
    key: string;
    subscription: PricingPlanSubscriptionExpanded;
    /** Names the section when the order has several subscriptions. */
    title?: string;
    seatsValues: Ref<ConfiguredMeterValue[]>;
    unitsValues: Ref<ConfiguredMeterValue[]>;
    minimums: { seatsValues: ConfiguredMeterValue[]; unitsValues: ConfiguredMeterValue[] };
    maximums: { seatsValues: ConfiguredMeterValue[]; unitsValues: ConfiguredMeterValue[] };
    /** The configs the customer may change; the others show at their number. */
    editableConfigIds: string[];
    /** Left out when the order's own `promotionCode` covers it. */
    promotionCode?: CheckoutPromotionCode;
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
    /** The add-ons bought in a quantity of their own; left out by a flow without add-on choices. */
    quantityAddonConfigIds?: Readonly<Ref<Set<string>>>;
    /**
     * A section per subscription, shown in place of the editor of `subscription` and without
     * its pricing choices. Held shallowly, like `customerForms`.
     */
    planCustomizations?: Readonly<Ref<CheckoutPlanCustomization[]>>;
    checkoutForm: ReturnType<typeof useCheckoutForm>;
    /**
     * A section per customer, shown and validated in place of `checkoutForm`'s own. Held shallowly
     * (`computed`, `shallowRef`): a deep `ref` would unwrap the refs each form keeps.
     */
    customerForms?: Readonly<Ref<CheckoutCustomerForm[]>>;
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
    /** Where the customer goes back to without paying; already sanitised. */
    cancelUrl?: Readonly<Ref<string | undefined>>;
    /** Markdown shown with the pay button. */
    note: Readonly<Ref<string | undefined>>;

    /** Absent when the flow keeps its state elsewhere and has no form to restore after a redirect. */
    saveFormStateForRedirect?: () => void;
    clearSavedFormState?: () => void;
}
