import { onMounted, ref, type Ref } from 'vue';
import type { ExpressPaymentMethodProps } from './ExpressPaymentMethod.types';
import { useLogger } from '@/components/providers';
import type { Logger } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import { getAdyenExpressCheckoutConfiguration } from '@/utils/adyen';

type AdyenCheckout = Awaited<ReturnType<typeof import('@adyen/adyen-web').AdyenCheckout>>;

type MountableExpressComponent = {
    isAvailable: () => Promise<void>;
    mount: (target: HTMLElement) => unknown;
};

/** The checkout every express button is built from, configured the same way for each of them. */
export async function createExpressCheckout(
    props: ExpressPaymentMethodProps,
    logger: Logger,
): Promise<AdyenCheckout> {
    const { AdyenCheckout: createCheckout } = await import('@adyen/adyen-web');

    return createCheckout(
        getAdyenExpressCheckoutConfiguration({
            locale: props.locale,
            amount: props.amount,
            countryCode: props.countryCode,
            paymentMethodOptionResponse: props.paymentMethodOptionsResponse,
            logger,
        }),
    );
}

/**
 * Builds the checkout, hands it to the caller to make its gateway's button from, and mounts that
 * button into the returned ref once the gateway reports it is available.
 *
 * The two failures are reported by the caller rather than here, since the lint rule behind
 * `npm run logs:list` needs every log code and message to be a literal where it is logged.
 */
export function useExpressPaymentMethod({
    props,
    create,
    onMissingButton,
    onMountFailed,
    afterMount,
}: {
    props: ExpressPaymentMethodProps;
    create: (checkout: AdyenCheckout) => Promise<MountableExpressComponent>;
    onMissingButton: () => void;
    onMountFailed: (error: unknown) => void;
    afterMount?: () => void;
}): { buttonRef: Ref<HTMLDivElement | undefined> } {
    const buttonRef = ref<HTMLDivElement>();
    const logger = useLogger();

    const mount = async () => {
        const checkout = await createExpressCheckout(props, logger);
        const component = await create(checkout);

        if (!buttonRef.value) {
            onMissingButton();
            return;
        }

        try {
            await component.isAvailable();
            component.mount(buttonRef.value);
            afterMount?.();
        } catch (error) {
            onMountFailed(error);
        }
    };

    onMounted(() => {
        void mount();
    });

    return { buttonRef };
}
