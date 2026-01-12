import type { CoreConfiguration, PaymentAmountExtended, RawPaymentMethod } from '@adyen/adyen-web';
import type {
    Amount,
    PaymentMethodOptionAdyen,
    PaymentMethodOptionResponseEntry,
} from '@solvimon/types';
import { trackSentryException } from './errorTracking';

export const PAYMENT_ACCEPTOR_ID_QUERY_STRING = 'payment_acceptor_id';
export const REDIRECT_RESULT_QUERY_STRING = 'redirectResult';

export function getAdyenClientKeyFromPaymentMethodOptionsResponse(
    paymentMethodOptionResponse: PaymentMethodOptionResponseEntry,
): string | undefined {
    return paymentMethodOptionResponse.integration.payment_gateway?.adyen?.public_key;
}

/**
 * Transforms a Solvimon amount to an Adyen amount.
 */
export function transformToAdyenAmount(amount: Amount): PaymentAmountExtended {
    const formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: amount.currency,
    });

    const { maximumFractionDigits = 10 } = formatter.resolvedOptions();

    return {
        value: Math.round(+amount.quantity * Math.pow(10, maximumFractionDigits)),
        currency: amount.currency,
    };
}

/**
 * Maps the Adyen payment methods to an array of RawPaymentMethod.
 * If no payment methods are found, returns an empty array.
 */
export function mapAdyenPaymentMethods(
    paymentMethodOptionResponse: PaymentMethodOptionResponseEntry,
): RawPaymentMethod[] {
    return (
        paymentMethodOptionResponse.options.flatMap((adyenPaymentMethodOption) =>
            mapAdyenPaymentMethod(adyenPaymentMethodOption.adyen),
        ) ?? []
    );
}

/**
 * Maps the Adyen payment method to a RawPaymentMethod.
 */
export function mapAdyenPaymentMethod(adyen: PaymentMethodOptionAdyen['adyen']): RawPaymentMethod {
    return {
        type: adyen.type,
        name: adyen.name,
        ...(adyen.issuers ? { issuers: adyen.issuers } : {}),
        ...(adyen.brands ? { brands: adyen.brands } : {}),
        ...(adyen.funding_source ? { fundingSource: adyen.funding_source } : {}),
        ...(adyen.configuration ? { configuration: adyen.configuration } : {}),
    };
}

/**
 * Creates a return URL for the Adyen advanced flow.
 */
export function createReturnUrl({
    paymentAcceptorId,
    redirectUrl = window.location.href,
}: {
    redirectUrl?: string;
    paymentAcceptorId: string;
}): string {
    const returnUrl = new URL(redirectUrl);
    returnUrl.searchParams.set(PAYMENT_ACCEPTOR_ID_QUERY_STRING, paymentAcceptorId);
    return returnUrl.toString();
}

/**
 * Gets the Adyen environment from the payment method options response.
 * If no environment is set, or the environment is not supported, it defaults to live.
 */
export function getAdyenEnvironmentFromPaymentMethodOptionsResponse(
    paymentMethodsOptionsResponse?: PaymentMethodOptionResponseEntry,
): CoreConfiguration['environment'] {
    const environment =
        paymentMethodsOptionsResponse?.integration.payment_gateway?.adyen?.environment;

    if (!environment) {
        trackSentryException(undefined, {
            Message: 'No environment set for adyen advanced flow, defaulted to live',
        });
        return 'live';
    }

    switch (environment) {
        case 'TEST':
            return 'test';
        case 'LIVE_IN':
            return 'live-in';
        case 'LIVE_AU':
            return 'live-au';
        case 'LIVE_US':
            return 'live-us';
        case 'LIVE_APSE':
            return 'live-apse';
        case 'LIVE':
            return 'live';
        default:
            trackSentryException(undefined, {
                Message: `Unsupported environment "${environment}" for adyen advanced flow, defaulted to "live"`,
            });
            return 'live';
    }
}

/**
 * Gets the Adyen express checkout configuration.
 */
export function getAdyenExpressCheckoutConfiguration({
    amount,
    countryCode,
    locale,
    paymentMethodOptionResponse,
}: {
    amount?: Amount;
    countryCode: CoreConfiguration['countryCode'];
    locale: CoreConfiguration['locale'];
    paymentMethodOptionResponse: PaymentMethodOptionResponseEntry;
}): CoreConfiguration {
    return {
        ...(amount ? { amount: transformToAdyenAmount(amount) } : {}),
        analytics: { enabled: false },
        clientKey: getAdyenClientKeyFromPaymentMethodOptionsResponse(paymentMethodOptionResponse),
        countryCode,
        environment: getAdyenEnvironmentFromPaymentMethodOptionsResponse(
            paymentMethodOptionResponse,
        ),
        locale,
        paymentMethodsResponse: {
            paymentMethods: mapAdyenPaymentMethods(paymentMethodOptionResponse),
        },
    };
}

/**
 * Transforms an object to an Adyen object.
 */
export function transformObjectToAdyenObject(obj?: object) {
    return obj
        ? Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, String(value)]))
        : undefined;
}
