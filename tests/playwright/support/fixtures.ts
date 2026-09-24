/**
 * Response builders for the mocked API.
 *
 * These are wire-format stubs, not application values: each carries the fields the checkout
 * actually reads and nothing else, so a test reads as though it depends only on what it steers.
 * Typing them as the full `Invoice` or `PricingPlanSubscriptionExpanded` would mean filling in
 * dozens of fields no screen touches, and would still not catch a contract change — only the API
 * can do that. A stored JSON dump has the same problem and drifts silently, so everything here is
 * built per test instead.
 */

export type Json = Record<string, unknown>;

export const SUBSCRIPTION_ID = 'ppsu_test_subscription';
export const CUSTOMER_ID = 'cus_test_customer';
export const DEFAULT_SCHEDULE_ID = 'ppsi_default';
export const TRIAL_SCHEDULE_ID = 'ppsi_trial';
export const PAYMENT_ACCEPTOR_ID = 'paya_test_acceptor';
export const SUCCESS_URL = 'https://merchant.example.com/welcome';

const PLATFORM_ID = 'plat_test';

export interface BillingPeriod {
    type: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
    value: number;
}

export const MONTHLY: BillingPeriod = { type: 'MONTH', value: 1 };
export const YEARLY: BillingPeriod = { type: 'YEAR', value: 1 };

export const billingPeriodKey = ({ type, value }: BillingPeriod) => `${type}:${value}`;

// ─── Tokens ───────────────────────────────────────────────────────────────────

/** A portal token is base64 of `<token user name>.<portal url resource id>`. */
function portalToken({
    tokenUserName = 'test-portal-user',
    portalUrlResourceId = 'purl_test',
}: { tokenUserName?: string; portalUrlResourceId?: string } = {}): string {
    return Buffer.from(`${tokenUserName}.${portalUrlResourceId}`).toString('base64');
}

export const TOKEN_USER_NAME = 'test-portal-user';

/**
 * A JWT-shaped access token. Nothing verifies it, but the SDK decodes it to decide when to refresh,
 * so `exp` has to be real — `expiresInSeconds` is what drives the refresh tests.
 */
export function accessToken({ expiresInSeconds = 60 * 60 } = {}): string {
    const encode = (value: Json) =>
        Buffer.from(JSON.stringify(value))
            .toString('base64')
            .replace(/=+$/, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');

    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({
        sub: TOKEN_USER_NAME,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });

    return `${header}.${payload}.test-signature`;
}

export const anAccessTokenResponse = ({ expiresInSeconds = 60 * 60 } = {}): Json => ({
    access_token: accessToken({ expiresInSeconds }),
    token_type: 'Bearer',
    expires_in: expiresInSeconds,
});

// ─── Portal object ────────────────────────────────────────────────────────────

export function aPortalObject({
    subscriptionId = SUBSCRIPTION_ID,
    successUrl = SUCCESS_URL,
    status = 'PUBLISHED',
    type = 'INIT_PRICING_PLAN_SUBSCRIPTION',
}: {
    subscriptionId?: string;
    successUrl?: string;
    status?: string;
    type?: string;
} = {}): Json {
    return {
        object_type: 'PORTAL_URL',
        id: 'purl_test',
        type,
        status,
        token: portalToken(),
        init_pricing_plan_subscription: {
            pricing_plan_subscription_id: subscriptionId,
            success_url: successUrl,
        },
    };
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export interface SeatPricing {
    /** What the seats editor sets, and what lands in the preview payload's `seats_values`. */
    pricingItemConfigId: string;
    name: string;
    defaultNumber?: string;
}

export interface AddonPricing {
    pricingId: string;
    name: string;
    preselected?: boolean;
}

const pricingItemConfig = ({
    id,
    currency,
    amount,
    defaultSeatsNumber,
}: {
    id: string;
    currency: string;
    amount: string;
    defaultSeatsNumber?: string;
}): Json => ({
    id,
    details: { bands: [{ amount: { quantity: amount, currency } }] },
    ...(defaultSeatsNumber ? { default_seats_value: { number: defaultSeatsNumber } } : {}),
});

const aPricing = ({
    id,
    name,
    productType,
    modelType,
    billingPeriods,
    currencies,
    configId,
    defaultSeatsNumber,
}: {
    id: string;
    name: string;
    productType: 'DEFAULT' | 'ADDON';
    modelType: string;
    billingPeriods: BillingPeriod[];
    currencies: string[];
    configId: string;
    defaultSeatsNumber?: string;
}): Json => ({
    id,
    name,
    product_type: productType,
    items: [
        {
            id: `${id}_item`,
            name,
            model_type: modelType,
            billing_period_configs: billingPeriods.map((period) => ({
                billing_period: period,
                configs: currencies.map((currency) =>
                    pricingItemConfig({
                        id: currencies.length > 1 ? `${configId}_${currency}` : configId,
                        currency,
                        amount: '10.00',
                        defaultSeatsNumber,
                    }),
                ),
            })),
        },
    ],
});

/**
 * A subscription as `GET /portal/pricing-plan-subscriptions/{id}?expand=ALL` returns it.
 *
 * Seats and add-ons are what puts the plan customization editor on screen: seats come off the
 * schedule's own `seats_values`, add-ons off the plan version's pricing groups. A plan with neither
 * renders no editor at all.
 */
export function aSubscription({
    id = SUBSCRIPTION_ID,
    name = 'Pro plan',
    billingPeriods = [MONTHLY],
    billingCurrency = 'EUR',
    pricingCurrencies = [billingCurrency],
    seats = [],
    addons = [],
    trial = false,
}: {
    id?: string;
    name?: string;
    billingPeriods?: BillingPeriod[];
    billingCurrency?: string;
    pricingCurrencies?: string[];
    seats?: SeatPricing[];
    addons?: AddonPricing[];
    trial?: boolean;
} = {}): Json {
    const startAt = '2026-01-01T00:00:00Z';

    const seatPricings = seats.map((seat, index) =>
        aPricing({
            id: `pri_seat_${index}`,
            name: seat.name,
            productType: 'DEFAULT',
            modelType: 'SEATS',
            billingPeriods,
            currencies: pricingCurrencies,
            configId: seat.pricingItemConfigId,
            defaultSeatsNumber: seat.defaultNumber ?? '1',
        }),
    );

    const addonPricings = addons.map((addon, index) =>
        aPricing({
            id: addon.pricingId,
            name: addon.name,
            productType: 'ADDON',
            modelType: 'RECURRING',
            billingPeriods,
            currencies: pricingCurrencies,
            configId: `pico_addon_${index}`,
        }),
    );

    const pricingPlanVersion: Json = {
        id: 'pplv_test',
        name,
        billing_period_settings: {
            billing_periods: billingPeriods.map((period) => ({ period })),
        },
        pricing_currency_settings: { pricing_currencies: pricingCurrencies },
        pricing_categories: [
            {
                id: 'prca_test',
                name: 'Plan',
                pricings: [...seatPricings, ...addonPricings],
                pricing_groups: addons.length
                    ? [
                          {
                              object_type: 'PRICING_GROUP',
                              id: 'prgr_addons',
                              name: 'Add-ons',
                              product_type: 'ADDON',
                              selection_constraint: 'ANY',
                              pricings: addonPricings,
                          },
                      ]
                    : [],
            },
        ],
    };

    const schedule = (scheduleId: string, type: 'DEFAULT' | 'TRIAL', endAt?: string): Json => ({
        id: scheduleId,
        type,
        start_at: startAt,
        ...(endAt ? { end_at: endAt } : {}),
        seats_values: seats.map((seat) => ({
            pricing_item_config_id: seat.pricingItemConfigId,
        })),
        enabled_pricings: addons
            .filter((addon) => addon.preselected)
            .map((addon) => ({ pricing_id: addon.pricingId })),
    });

    const scheduleInfo = (scheduleId: string, type: 'DEFAULT' | 'TRIAL', endAt?: string): Json => ({
        id: scheduleId,
        type,
        start_at: startAt,
        ...(endAt ? { end_at: endAt } : {}),
        pricing_plan_schedule: schedule(scheduleId, type, endAt),
        pricing_plan_version: pricingPlanVersion,
    });

    return {
        object_type: 'PRICING_PLAN_SUBSCRIPTION',
        id,
        name,
        status: 'ACTIVE',
        type: 'BILLING',
        platform_id: PLATFORM_ID,
        customer_id: CUSTOMER_ID,
        billing_currency: billingCurrency,
        billing_period: billingPeriods[0],
        created_at: startAt,
        updated_at: startAt,
        pricing_plan_schedule_infos: [
            ...(trial ? [scheduleInfo(TRIAL_SCHEDULE_ID, 'TRIAL', '2026-01-15T00:00:00Z')] : []),
            scheduleInfo(DEFAULT_SCHEDULE_ID, 'DEFAULT'),
        ],
    };
}

// ─── Invoice preview ──────────────────────────────────────────────────────────

const amount = (quantity: string, currency: string) => ({ quantity, currency });

interface InvoiceOptions {
    total?: string;
    tax?: string;
    currency?: string;
    billingPeriod?: BillingPeriod;
    /** Renders as a usage-based plan, which changes the copy and drops the fixed total. */
    usageBased?: boolean;
    description?: string;
}

function anInvoice({
    total = '20.00',
    tax = '0.00',
    currency = 'EUR',
    billingPeriod = MONTHLY,
    usageBased = false,
    description = 'Pro plan',
}: InvoiceOptions = {}): Json {
    const base = (Number(total) - Number(tax)).toFixed(2);

    const line: Json = {
        id: 'ivl_1',
        line_order: 1,
        pricing_item_config_id: 'pico_1',
        pricing_item_id: 'pit_1',
        pricing_type: 'RECURRING',
        type: 'PRICING',
        description,
        product_items: [
            { model_type: usageBased ? 'USAGE_BASED' : 'RECURRING', name: description },
        ],
        tax_categories: [],
        amount_excluding_tax: amount(base, currency),
        amount_including_tax: amount(total, currency),
    };

    const group: Json = {
        group_order: 1,
        type: 'PRICING',
        description,
        billing_period: billingPeriod,
        start_at: '2026-01-01T00:00:00Z',
        end_at: '2026-02-01T00:00:00Z',
        amount_excluding_tax: amount(base, currency),
        amount_including_tax: amount(total, currency),
        pricing_plan_subscription_id: SUBSCRIPTION_ID,
        billing_customer_id: CUSTOMER_ID,
        product_category: { id: 'prct_1', name: 'Plan' },
        tax_categories: [],
        lines: [line],
    };

    return {
        id: 'inv_preview',
        invoice_number: 'PREVIEW',
        platform_id: PLATFORM_ID,
        status: 'DRAFT',
        type: 'STANDARD',
        billing_currency: currency,
        invoice_date: '2026-01-01T00:00:00Z',
        due_date: '2026-01-15T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        timezone: 'UTC',
        billing_period: billingPeriod,
        invoice_amount_including_tax: amount(total, currency),
        open_invoice_amount: amount(total, currency),
        has_usage_based_pricing: usageBased,
        lines: [line],
        tax_categories: [],
        tax_summary: {
            base_amount: amount(base, currency),
            tax_amount: amount(tax, currency),
            total_amount: amount(total, currency),
            country_code: 'NL',
        },
        periods: [
            {
                period_order: 1,
                billing_period: billingPeriod,
                start_at: '2026-01-01T00:00:00Z',
                end_at: '2026-02-01T00:00:00Z',
                amount_excluding_tax: amount(base, currency),
                amount_including_tax: amount(total, currency),
                tax_categories: [],
                groups: [group],
            },
        ],
        payment_acceptor_ids: [PAYMENT_ACCEPTOR_ID],
        payment_actions: [],
        other_custom_fields: [],
        on_hold: false,
    };
}

/**
 * The `POST /portal/invoices/preview` envelope. `first_invoice` is what the screen shows as the
 * trial invoice, and `invoice_infos` is where it looks up the invoice for the DEFAULT schedule.
 */
export function anInvoicePreview({
    trialTotal,
    scheduleId = DEFAULT_SCHEDULE_ID,
    ...invoice
}: InvoiceOptions & { trialTotal?: string; scheduleId?: string } = {}): Json {
    const regular = anInvoice(invoice);
    const first =
        trialTotal === undefined
            ? regular
            : anInvoice({ ...invoice, total: trialTotal, tax: '0.00' });

    return {
        invoice: regular,
        first_invoice: first,
        invoice_infos: [{ pricing_plan_schedule_id: scheduleId, invoices: [regular] }],
    };
}

// ─── Payment method options ───────────────────────────────────────────────────

/**
 * `POST /portal/payment-method-options`. The gateway decides which integration form the screen
 * mounts — STRIPE is the one the suite can drive end to end (see `stripe-stub.ts`).
 */
export function paymentMethodOptions({
    gateways = ['STRIPE'],
}: { gateways?: ('STRIPE' | 'ADYEN')[] } = {}): Json[] {
    return gateways.map((gateway, index) => ({
        payment_acceptor: { id: index === 0 ? PAYMENT_ACCEPTOR_ID : `paya_test_${index}` },
        integration: {
            id: `int_test_${index}`,
            payment_gateway: {
                variant: gateway,
                ...(gateway === 'STRIPE'
                    ? { stripe: { public_key: 'pk_test_solvimon' } }
                    : {
                          adyen: {
                              company_account: 'TestCompany',
                              environment: 'TEST',
                              merchant_accounts: ['TestMerchant'],
                              public_key: 'test-client-key',
                              live_prefix: '',
                              ownership: 'SYSTEM',
                          },
                      }),
            },
        },
        options: [
            gateway === 'STRIPE'
                ? {
                      name: 'Card',
                      payment_method_variant: 'CARD',
                      payment_gateway_variant: 'STRIPE',
                      stripe: { name: 'Card', type: 'card' },
                  }
                : {
                      name: 'Card',
                      payment_method_variant: 'CARD',
                      payment_gateway_variant: 'ADYEN',
                      adyen: { name: 'Card', type: 'scheme', brands: ['visa', 'mc'] },
                  },
        ],
    }));
}

// ─── Payment results ──────────────────────────────────────────────────────────

export const aSuccessfulAuthorization = (): Json => ({
    status: 'SUCCESS',
    payment_id: 'pay_test',
});

export const aFailedAuthorization = (): Json => ({
    status: 'FAILURE',
    error: { code: 'REFUSED', message: 'The card was declined' },
});

/** Stripe's 3DS leg: the SDK hands the client secret to `handleNextAction` and reports the result. */
export const anActionRequiredAuthorization = (): Json => ({
    status: 'ACTION_REQUIRED',
    action: {
        payment_gateway_variant: 'STRIPE',
        client_secret: 'pi_test_secret',
    },
});

// ─── Customer-scoped screens ──────────────────────────────────────────────────

export const PAYMENT_METHOD_ID = 'pmet_test_card';
export const INVOICE_ID = 'inv_test_invoice';

/** The `ApiSuccessCollectionResponse` envelope every list endpoint answers with. */
export const collection = (data: Json[]): Json => ({
    data,
    page: 1,
    limit: 20,
    total_number_of_pages: 1,
    links: { current: '/v1/portal/resource?page=1' },
});

/**
 * A portal object of type `CUSTOMER`, which is what every screen but the checkout is opened with.
 * `display` and `options` are the host's own switches over what the customer may see and do, so
 * they are what a test flips to assert a section is or is not on screen.
 */
export function aCustomerPortalObject({
    customerId = CUSTOMER_ID,
    status = 'PUBLISHED',
    type = 'CUSTOMER',
    display = {},
    options = {},
}: {
    customerId?: string;
    status?: string;
    type?: string;
    display?: Record<string, boolean>;
    options?: Record<string, boolean>;
} = {}): Json {
    return {
        object_type: 'PORTAL_URL',
        id: 'purl_test_customer',
        type,
        status,
        token: portalToken(),
        customer_id: customerId,
        embedded: false,
        url: 'https://portal.example.com/customer',
        created_at: '2026-01-01T00:00:00Z',
        customer: {
            display: {
                usage: true,
                invoices: true,
                pricing_plan_subscriptions: true,
                payment_acceptors: true,
                ...display,
            },
            options: {
                edit_customer_details: true,
                download_invoice: true,
                pay_open_invoice: true,
                combine_open_invoices: true,
                ...options,
            },
        },
        widgets: { usage: '', invoices: '', pricing_plan_subscriptions: '' },
    };
}

export function aCustomer({
    id = CUSTOMER_ID,
    name = 'Ada Lovelace',
    email = 'ada@example.com',
    type = 'INDIVIDUAL',
    country = 'NL',
}: {
    id?: string;
    name?: string;
    email?: string;
    type?: 'INDIVIDUAL' | 'ORGANIZATION';
    country?: string;
} = {}): Json {
    const address = {
        line1: 'Keizersgracht 1',
        city: 'Amsterdam',
        postal_code: '1015 CJ',
        country,
    };

    return {
        object_type: 'CUSTOMER',
        id,
        reference: 'customer-1',
        status: 'ACTIVE',
        platform_id: PLATFORM_ID,
        email,
        type,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        billing_currency: 'EUR',
        ...(type === 'ORGANIZATION'
            ? { organization: { legal_name: name, registered_address: address } }
            : {
                  individual: {
                      name: { first_name: 'Ada', last_name: 'Lovelace' },
                      residential_address: address,
                  },
              }),
    };
}

export function aPaymentMethod({
    id = PAYMENT_METHOD_ID,
    isDefault = false,
    status = 'ACTIVE',
    lastFourDigits = '4242',
    brand = 'VISA',
}: {
    id?: string;
    isDefault?: boolean;
    status?: string;
    lastFourDigits?: string;
    brand?: string;
} = {}): Json {
    return {
        object_type: 'PAYMENT_METHOD',
        id,
        reference: `card-${lastFourDigits}`,
        status,
        is_default: isDefault,
        type: 'CARD',
        customer_id: CUSTOMER_ID,
        created_at: '2026-01-01T00:00:00Z',
        integration_id: 'int_test_0',
        integration_details: {
            payment_gateway_variant: 'STRIPE',
            stripe: { payment_method_id: 'pm_test' },
        },
        card: {
            brand,
            name: 'Ada Lovelace',
            last_four_digits: lastFourDigits,
            expiry_date: { expiry_month: 3, expiry_year: 2030 },
            country: 'NL',
        },
    };
}

/** An invoice as the list and detail endpoints return it, rather than as a preview envelope. */
export function anInvoiceRecord({
    id = INVOICE_ID,
    number = 'INV-2026-001',
    total = '20.00',
    currency = 'EUR',
    status = 'FINAL',
    paid = false,
    openAmount,
}: {
    id?: string;
    number?: string;
    total?: string;
    currency?: string;
    status?: string;
    paid?: boolean;
    openAmount?: string;
} = {}): Json {
    const invoice = anInvoice({ total, currency });

    return {
        ...invoice,
        id,
        invoice_number: number,
        status,
        paid,
        open_invoice_amount: { quantity: openAmount ?? (paid ? '0.00' : total), currency },
        payment_actions: [],
        // The screens date everything in the customer's timezone and name the seller from the
        // billing entity, so a record without either renders nothing at all.
        customer: { ...aCustomer(), timezone: 'Europe/Amsterdam' },
        billing_entity: {
            object_type: 'BILLING_ENTITY',
            id: 'bent_test',
            legal_name: 'Solvimon B.V.',
            timezone: 'Europe/Amsterdam',
        },
    };
}

export const aWalletBalance = ({
    walletId = 'wall_test',
    quantity = '100',
    currency = 'EUR',
}: { walletId?: string; quantity?: string; currency?: string } = {}): Json => ({
    wallet_id: walletId,
    wallet_balance: {
        balance: { amount: { quantity, currency } },
        reserved_balance: { amount: { quantity: '0.00', currency } },
    },
});

export const walletBalances = (balances: Json[] = [aWalletBalance()]): Json => ({
    wallet_balances: balances,
});
