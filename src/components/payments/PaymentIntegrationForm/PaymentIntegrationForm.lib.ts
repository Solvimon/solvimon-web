import type {
    PaymentGatewayVariant,
    PaymentMethodOptionResponseEntry,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import { getAdyenDropInPaymentMethods } from '@/utils/adyen';

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

export const isRenderablePaymentIntegration = (
    paymentMethodOption: PaymentMethodOptionResponseEntry,
    { excludeExpressPaymentMethods = false }: { excludeExpressPaymentMethods?: boolean } = {},
): boolean => {
    if (isAdyenPaymentIntegration(paymentMethodOption)) {
        return (
            getAdyenDropInPaymentMethods(paymentMethodOption, { excludeExpressPaymentMethods })
                .length > 0
        );
    }

    if (isStripePaymentIntegration(paymentMethodOption)) {
        return !!paymentMethodOption.integration.payment_gateway.stripe?.public_key;
    }

    return false;
};

export const hasRenderablePaymentIntegration = (
    paymentMethodOptions: PaymentMethodOptionsResponse,
    options: { excludeExpressPaymentMethods?: boolean } = {},
): boolean =>
    paymentMethodOptions.some((paymentMethodOption) =>
        isRenderablePaymentIntegration(paymentMethodOption, options),
    );
