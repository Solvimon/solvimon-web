import type { Amount } from '@solvimon/solvimon-types';
import type { StripeFrameOptions } from './PaymentIntegrationFormStripeFrame.types';
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
}: {
    amount: Amount;
    email?: string;
    name?: string;
    variant: 'TOKENIZE' | 'AUTHORIZE';
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
        setup_future_usage: 'off_session',
        wallets: STRIPE_WALLETS,
        fields,
        appearance: STRIPE_APPEARANCE,
    };
}
