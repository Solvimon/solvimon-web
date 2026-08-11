import type { PaymentMethod } from '@solvimon/solvimon-types';
import type { RadioGroupExtendedProps } from '@solvimon/solvimon-ui';
import { computed, type ComputedRef, type Ref } from 'vue';

type PaymentMethodOption = RadioGroupExtendedProps['options'][number];

/** Turns an API constant like `SEPA_DIRECT_DEBIT` into `Sepa direct debit`. */
const humanise = (value: string) =>
    value
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/^./, (character) => character.toUpperCase());

/**
 * A short, readable name for a payment method.
 *
 * Each row is drawn by the `PaymentMethod` component, which assistive technology cannot summarise
 * on its own, so this becomes the radio option's accessible name. It is built from identifiers the
 * API already returns — brand, variant, owner, last digits — rather than translated copy, so it
 * needs no per-type wording in every locale.
 */
function getAccessibleName(paymentMethod: PaymentMethod): string {
    const parts: (string | undefined)[] = [];

    switch (paymentMethod.type) {
        case 'CARD':
            parts.push(
                paymentMethod.card.brand && humanise(paymentMethod.card.brand),
                paymentMethod.card.last_four_digits,
            );
            break;
        case 'ONLINE_BANKING':
            parts.push(
                paymentMethod.online_banking?.variant &&
                    humanise(paymentMethod.online_banking.variant),
                paymentMethod.online_banking?.owner_name,
            );
            break;
        case 'DIRECT_DEBIT':
            parts.push(
                paymentMethod.direct_debit?.variant && humanise(paymentMethod.direct_debit.variant),
                paymentMethod.direct_debit?.owner_name,
            );
            break;
        case 'BUY_NOW_PAY_LATER':
            parts.push(
                paymentMethod.buy_now_pay_later?.variant &&
                    humanise(paymentMethod.buy_now_pay_later.variant),
            );
            break;
        case 'DIGITAL_WALLET':
            parts.push(
                paymentMethod.digital_wallet?.variant &&
                    humanise(paymentMethod.digital_wallet.variant),
            );
            break;
    }

    const name = parts.filter(Boolean).join(' ');

    // A sparsely populated method would otherwise leave the option with no accessible name at all.
    return name || humanise(paymentMethod.type);
}

/**
 * Maps saved payment methods onto `RadioGroupExtended` options, alongside a lookup the prefix slot
 * uses to render each row with the shared `PaymentMethod` component.
 */
export function usePaymentMethodSelectorOptions(paymentMethods: Ref<PaymentMethod[]>): {
    options: ComputedRef<PaymentMethodOption[]>;
    paymentMethodsById: ComputedRef<Record<string, PaymentMethod>>;
} {
    const options = computed<PaymentMethodOption[]>(() =>
        paymentMethods.value.map((paymentMethod) => ({
            value: paymentMethod.id,
            label: getAccessibleName(paymentMethod),
        })),
    );

    const paymentMethodsById = computed<Record<string, PaymentMethod>>(() =>
        Object.fromEntries(
            paymentMethods.value.map((paymentMethod) => [paymentMethod.id, paymentMethod]),
        ),
    );

    return { options, paymentMethodsById };
}
