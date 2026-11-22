import { useIntl } from '@solvimon/solvimon-ui';

/** The customer-facing words for a refusal from the payment acceptors API, in the SDK's languages. */
export function usePaymentAcceptorErrorMessages() {
    const { $t } = useIntl();

    const fieldRefused = () =>
        $t({
            defaultMessage: "This value isn't accepted. Check it and try again.",
            id: 'payment_acceptor_errors.field_refused',
            description:
                'Shown on a bank account field the API refused, in place of its technical message',
        });

    const inUse = () =>
        $t({
            defaultMessage:
                "You can't delete this payment acceptor because a subscription or invoice uses it.",
            id: 'payment_acceptor_errors.in_use',
            description:
                'Shown when a payment acceptor cannot be deleted because a subscription or invoice still uses it',
        });

    return { fieldRefused, inUse };
}
