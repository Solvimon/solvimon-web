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
 * Where the frame is posted to. It is a blob document of the page, so it shares the page's origin;
 * an opaque origin ('null') cannot be named as a target, and there the frame relies on checking
 * that messages come from its parent window.
 */
export function getFrameTargetOrigin(pageOrigin: string): string {
    return pageOrigin === 'null' ? '*' : pageOrigin;
}

/** A Stripe error can carry the intent it is about, client secret included, so only this leaves. */
export function summarizeStripeError(error: StripeError): StripeSubmitError {
    return { code: error.code, type: error.type, message: error.message };
}
