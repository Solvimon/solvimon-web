import { useIntl } from '@solvimon/solvimon-ui';
import type { FormFieldError } from '@solvimon/solvimon-types';
import {
    getRefusedShownField,
    isPaymentAcceptorInUse,
} from '@/components/payments/PaymentAcceptorForm/PaymentAcceptorForm.lib';

/**
 * What the customer is told when the payment acceptors API refuses a change, in the SDK's
 * languages. The API's own messages are English and technical, so they go to the logs only.
 */
export function usePaymentAcceptorErrorMessages() {
    const { $t } = useIntl();

    const somethingWentWrong = () =>
        $t({
            defaultMessage: 'Something went wrong. Please try again.',
            id: 'payment_acceptors_modal.error',
            description: 'Error shown in the payment acceptors modal when a change cannot be made',
        });

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

    /** A refused field the form shows goes on that field; anything else is a message above it. */
    const describeSaveError = (
        error: unknown,
    ): { apiError: FormFieldError; message?: never } | { apiError?: never; message: string } => {
        const refusedField = getRefusedShownField(error);
        return refusedField
            ? { apiError: { [refusedField]: fieldRefused() } }
            : { message: somethingWentWrong() };
    };

    const describeDeleteError = (error: unknown): string =>
        isPaymentAcceptorInUse(error) ? inUse() : somethingWentWrong();

    return { describeSaveError, describeDeleteError };
}
