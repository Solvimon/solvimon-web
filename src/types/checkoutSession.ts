import type {
    Address,
    CheckoutSessionNewCustomerType,
    CheckoutSessionStatus,
    ConfiguredMeterValue,
    CreatedCheckoutSessionPortalUrl,
    Invoice,
    Name,
    PortalUrl,
    PricingPlanSubscription,
    TaxIdentifier,
} from '@solvimon/solvimon-types';

/** A `CLOSED` link (its session COMPLETED or FAILED) can still be read. */
export type CheckoutSessionPortalUrlStatus = 'PUBLISHED' | 'REVOKED' | 'CLOSED';

/** The portal object a host passes for a checkout session link; `token` is the handle. */
export interface CheckoutSessionPortalUrl extends Omit<
    CreatedCheckoutSessionPortalUrl,
    'status' | 'expires_at' | 'url'
> {
    status: CheckoutSessionPortalUrlStatus;
    expires_at?: string;
    url?: string;
}

export type CheckoutSessionFieldDisplay = 'EDITABLE' | 'READ_ONLY' | 'HIDDEN';

export interface CheckoutSessionEffectiveDisplay {
    customer_details: CheckoutSessionFieldDisplay;
    address: CheckoutSessionFieldDisplay;
    tax_ids: CheckoutSessionFieldDisplay;
    email: CheckoutSessionFieldDisplay;
    custom_fields: CheckoutSessionFieldDisplay;
}

/** A customer the session creates when it completes. */
export interface CheckoutSessionNewCustomer {
    reference: string;
    type: CheckoutSessionNewCustomerType;
    email?: string;
    locale?: string;
    timezone?: string;
    roles?: string[];
    custom_fields?: Record<string, unknown>[];
    individual?: {
        name?: Partial<Pick<Name, 'first_name' | 'last_name' | 'infix'>>;
        residential_address?: Address;
    };
    organization?: {
        legal_name?: string;
        tax_id?: string;
        tax_ids?: TaxIdentifier[];
        registration_number?: string;
        tax_exempt?: boolean;
        tax_exempt_note?: string;
        registered_address?: Address;
        tax_registrations?: Record<string, unknown>[];
    };
}

export interface CheckoutSessionReadableCustomer {
    customer_id?: string;
    customer?: CheckoutSessionNewCustomer;
    parent_customer?: unknown;
    display?: Partial<CheckoutSessionEffectiveDisplay>;
    effective_display: CheckoutSessionEffectiveDisplay;
}

export interface CheckoutSessionMeterBound {
    pricing_item_config_id: string;
    min: { number: string };
    max: { number: string };
}

export interface CheckoutSessionScheduleCustomization {
    pricing_plan_schedule_id: string;
    seats_values?: ConfiguredMeterValue[];
    units?: ConfiguredMeterValue[];
    coupons?: unknown[];
    promotion_codes?: string[];
}

export interface CheckoutSessionSubscription {
    template_pricing_plan_subscription_id: PricingPlanSubscription['id'];
    pricing_plan_subscription: {
        reference: string;
        customer_id?: string;
        customer_reference?: string;
        variant?: string;
        forward_customer_id?: string;
        forward_customer_reference?: string;
    };
    pricing_plan_schedule_customizations?: CheckoutSessionScheduleCustomization[];
    options?: {
        edit_seats?: CheckoutSessionMeterBound[];
        edit_units?: CheckoutSessionMeterBound[];
        allow_promotion_codes?: 'NONE' | 'SINGLE';
    };
    starting_values?: {
        pricing_plan_schedule_id: string;
        seats_values?: ConfiguredMeterValue[];
        units?: ConfiguredMeterValue[];
    }[];
}

export interface CheckoutSession {
    status: CheckoutSessionStatus;
    payment_status: 'UNPAID' | 'PAID';
    version: number;
    completed_at?: string;
    success_url?: string;
    cancel_url?: string;
    locale?: string;
    /** Markdown. */
    note?: string;
    display?: Partial<CheckoutSessionEffectiveDisplay>;
    customers: CheckoutSessionReadableCustomer[];
    pricing_plan_subscriptions: CheckoutSessionSubscription[];
    payment?: {
        customer_id?: string;
        customer_reference?: string;
        payment_acceptor_ids?: string[];
        store_payment_method?: boolean;
    };
    result?: unknown;
    /** Paths such as `checkout_session.customers.0.customer.email`; absent when nothing is missing. */
    missing_fields?: string[];
}

/** `GET` and `PATCH {transaction}/portal/portal-urls/{id}`. */
export interface CheckoutSessionPortalUrlResponse {
    object_type: 'PORTAL_URL';
    id: string;
    type: 'CHECKOUT_SESSION';
    status: CheckoutSessionPortalUrlStatus;
    checkout_session: CheckoutSession;
}

export type CheckoutSessionAddressPatch = Partial<Address>;

/**
 * The customer keys a buyer may send: the rest (`type`, `reference`, `locale`, …) is refused, and
 * `null` only clears the lists that take it.
 */
export interface CheckoutSessionCustomerPatch {
    email?: string;
    custom_fields?: Record<string, unknown>[] | null;
    individual?: {
        name?: Partial<Pick<Name, 'first_name' | 'last_name' | 'infix'>>;
        residential_address?: CheckoutSessionAddressPatch;
    };
    organization?: {
        legal_name?: string;
        tax_id?: string;
        tax_ids?: Pick<TaxIdentifier, 'id' | 'type'>[] | null;
        registration_number?: string;
        tax_exempt?: boolean;
        tax_exempt_note?: string;
        registered_address?: CheckoutSessionAddressPatch;
        tax_registrations?: Record<string, unknown>[] | null;
    };
}

export interface CheckoutSessionCustomizationPatch {
    pricing_plan_schedule_id: string;
    seats_values?: ConfiguredMeterValue[];
    units?: ConfiguredMeterValue[];
    promotion_codes?: string[] | null;
}

/** Positional: entry i edits entry i, and `{}` leaves it alone. */
export interface CheckoutSessionPatchBody {
    checkout_session: {
        expected_version: number;
        customers?: ({ customer: CheckoutSessionCustomerPatch } | Record<string, never>)[];
        pricing_plan_subscriptions?: (
            | { pricing_plan_schedule_customizations: CheckoutSessionCustomizationPatch[] }
            | Record<string, never>
        )[];
    };
}

/** `POST {transaction}/portal/portal-urls/{id}/preview`. */
export interface CheckoutSessionPreview {
    invoices?: {
        customer_reference: string;
        customer_id?: string;
        invoice: Invoice;
        pricing_plan_subscription_references: string[];
    }[];
    /** Decimal strings such as `"268.00"`. */
    total?: {
        currency: string;
        amount_excl_tax: string;
        tax: string;
        amount_incl_tax: string;
    };
    per_subscription?: {
        pricing_plan_subscription_reference: string;
        invoice_infos: unknown[];
    }[];
    checkout_session: { version: number; missing_fields?: string[] };
}

/** Every portal object an element can be given; the types package lacks the checkout session. */
export type PortalObject = PortalUrl | CheckoutSessionPortalUrl;
