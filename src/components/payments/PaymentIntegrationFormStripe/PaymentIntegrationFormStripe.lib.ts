import type { Amount } from '@solvimon/solvimon-types';
import type { StripeError } from '@stripe/stripe-js';
import { isEqual } from '@solvimon/solvimon-ui';
import type {
    StripeFrameOptions,
    StripeFrameOptionsUpdate,
    StripeSubmitError,
} from './PaymentIntegrationFormStripeFrame.types';
import { toMinorUnitAmount } from '@/utils/amount';

const STRIPE_WALLETS = { link: 'never' as const };
const STRIPE_APPEARANCE = {
    variables: { borderRadius: '4px', colorBackground: 'rgba(243, 244, 246, 0.5)' },
    rules: {
        '.TermsText': { fontSize: '14px' },
        '.Input': {
            backgroundColor: 'rgba(243, 244, 246, 0.5)',
            fontSize: '14px',
            borderColor: 'rgb(229, 231, 235)',
        },
    },
};

function getFields(email?: string, name?: string) {
    return {
        billingDetails: {
            address: { country: 'never' as const },
            ...(email ? { email: 'never' as const } : {}),
            ...(name ? { name: 'never' as const } : {}),
        },
    };
}

export function getFrameOptions({
    amount,
    email,
    name,
    variant,
    storePaymentMethod = false,
}: {
    amount: Amount;
    email?: string;
    name?: string;
    variant: 'TOKENIZE' | 'AUTHORIZE';
    /** Whether the method is to be kept for later. Tokenizing is always keeping it. */
    storePaymentMethod?: boolean;
}): StripeFrameOptions {
    const currency = amount.currency.toLowerCase();
    const fields = getFields(email, name);

    if (variant === 'TOKENIZE') {
        return {
            mode: 'setup',
            currency,
            setup_future_usage: 'off_session',
            wallets: STRIPE_WALLETS,
            fields,
            appearance: STRIPE_APPEARANCE,
        };
    }

    return {
        mode: 'payment',
        currency,
        amount: toMinorUnitAmount(amount).value,
        ...(storePaymentMethod ? { setup_future_usage: 'off_session' as const } : {}),
        wallets: STRIPE_WALLETS,
        fields,
        appearance: STRIPE_APPEARANCE,
    };
}

/**
 * What brings the mounted Payment Element from one set of options to the next while keeping what
 * the customer typed, or `undefined` when only a new Payment Element can show the next ones.
 */
export function getFrameOptionsUpdate(
    previous: StripeFrameOptions,
    next: StripeFrameOptions,
): StripeFrameOptionsUpdate | undefined {
    if (
        previous.mode !== next.mode ||
        !isEqual(previous.fields, next.fields) ||
        !isEqual(previous.wallets, next.wallets)
    ) {
        return undefined;
    }

    return {
        currency: next.currency,
        ...(next.mode === 'payment' ? { amount: next.amount } : {}),
        setup_future_usage: next.setup_future_usage ?? null,
        ...(next.appearance ? { appearance: next.appearance } : {}),
    };
}

/**
 * Where the frame is posted to, given the page's document origin (`window.origin`). The frame is a
 * blob document of the page and shares that origin. In a frame sandboxed without
 * allow-same-origin the document origin is opaque ('null') while `location.origin` still names the
 * URL, and an opaque origin cannot be named as a target; there the frame relies on checking that
 * messages come from its parent window.
 */
export function getFrameTargetOrigin(documentOrigin: string): string {
    return documentOrigin === 'null' ? '*' : documentOrigin;
}

const STRIPE_ERROR_TYPES: Record<StripeError['type'], true> = {
    api_connection_error: true,
    api_error: true,
    authentication_error: true,
    card_error: true,
    idempotency_error: true,
    invalid_request_error: true,
    rate_limit_error: true,
    validation_error: true,
};

export function isStripeErrorType(value: unknown): value is StripeError['type'] {
    return typeof value === 'string' && Object.hasOwn(STRIPE_ERROR_TYPES, value);
}

/**
 * A Stripe error can carry the intent it is about, client secret included, so only this leaves.
 * Takes whatever Stripe.js returned or threw, and never hands back the object itself.
 */
export function summarizeStripeError(error: unknown): StripeSubmitError {
    if (typeof error !== 'object' || error === null) return {};
    const code: unknown = Reflect.get(error, 'code');
    const type: unknown = Reflect.get(error, 'type');
    const message: unknown = Reflect.get(error, 'message');
    return {
        code: typeof code === 'string' ? code : undefined,
        type: isStripeErrorType(type) ? type : undefined,
        message: typeof message === 'string' ? message : undefined,
    };
}
