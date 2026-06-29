import type {
    PaymentGatewayVariant,
    PaymentMethodOptionResponseEntry,
} from '@solvimon/solvimon-types';

type PaymentMethodOptionResponseEntryWithGatewayVariant<TVariant extends PaymentGatewayVariant> =
    PaymentMethodOptionResponseEntry & {
        integration: PaymentMethodOptionResponseEntry['integration'] & {
            payment_gateway: NonNullable<
                PaymentMethodOptionResponseEntry['integration']['payment_gateway']
            > & {
                variant: TVariant;
            };
        };
    };

export const isAdyenPaymentIntegration = (
    paymentMethodOption: PaymentMethodOptionResponseEntry,
): paymentMethodOption is PaymentMethodOptionResponseEntryWithGatewayVariant<'ADYEN'> =>
    paymentMethodOption.integration.payment_gateway?.variant === 'ADYEN';

export const isStripePaymentIntegration = (
    paymentMethodOption: PaymentMethodOptionResponseEntry,
): paymentMethodOption is PaymentMethodOptionResponseEntryWithGatewayVariant<'STRIPE'> =>
    paymentMethodOption.integration.payment_gateway?.variant === 'STRIPE';

export const isSelectedIntegration = ({
    selectedIntegration,
    paymentMethodOption,
}: {
    selectedIntegration?: PaymentGatewayVariant;
    paymentMethodOption: PaymentMethodOptionResponseEntry;
}) => selectedIntegration === paymentMethodOption.integration?.payment_gateway?.variant;
