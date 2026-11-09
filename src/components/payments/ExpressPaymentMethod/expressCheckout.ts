import type { CoreConfiguration } from '@adyen/adyen-web';
import type { ExpressPaymentMethodProps } from './ExpressPaymentMethod.types';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { getAdyenExpressCheckoutConfiguration } from '@/utils/adyen';
import { loadAdyenSdk, type AdyenSdk } from '@/utils/adyenSdk';

type AdyenCheckout = Awaited<ReturnType<AdyenSdk['AdyenCheckout']>>;

/** The Adyen checkout the Apple Pay express button is built from. */
export async function createExpressCheckout(
    props: ExpressPaymentMethodProps,
    logger: Logger,
    { onSubmit }: { onSubmit?: CoreConfiguration['onSubmit'] } = {},
): Promise<AdyenCheckout> {
    const { AdyenCheckout: createCheckout } = await loadAdyenSdk();

    return createCheckout(
        getAdyenExpressCheckoutConfiguration({
            locale: props.locale,
            amount: props.amount,
            countryCode: props.countryCode,
            paymentMethodOptionResponse: props.paymentMethodOptionsResponse,
            logger,
            onSubmit,
        }),
    );
}
