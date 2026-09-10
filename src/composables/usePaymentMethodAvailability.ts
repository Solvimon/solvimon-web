import type { PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';
import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { hasRenderablePaymentIntegration } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.lib';
import { useExperimentalFeature } from '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature';
import { useLogger } from '@/components/providers';

/**
 * Options start out as an empty array and stay that way when a gateway has nothing to offer, so a
 * screen that only asks "are there any" renders fetching and broken identically. Hence three.
 */
export type PaymentMethodAvailability = 'LOADING' | 'UNAVAILABLE' | 'READY';

export interface PaymentMethodAvailabilityContext {
    invoiceId?: string;
    subscriptionId?: string;
}

export function usePaymentMethodAvailability({
    paymentMethodOptions,
    isLoading,
    context,
}: {
    paymentMethodOptions: MaybeRefOrGetter<PaymentMethodOptionsResponse | undefined>;
    isLoading: MaybeRefOrGetter<boolean | undefined>;
    context?: MaybeRefOrGetter<PaymentMethodAvailabilityContext>;
}) {
    const logger = useLogger();
    const experimentalFeatures = useExperimentalFeature();

    const options = computed<PaymentMethodOptionsResponse>(
        () => toValue(paymentMethodOptions) ?? [],
    );

    const availability = computed<PaymentMethodAvailability>(() => {
        if (toValue(isLoading)) {
            return 'LOADING';
        }

        return hasRenderablePaymentIntegration(options.value, {
            excludeExpressPaymentMethods: !!experimentalFeatures?.value?.['express-checkout'],
        })
            ? 'READY'
            : 'UNAVAILABLE';
    });

    /**
     * By acceptor rather than by code alone, so a misconfigured merchant is one issue whose event
     * count is the number of customers who could not pay, not one issue per invoice.
     */
    const fingerprint = computed(() => {
        const paymentAcceptorIds = [
            ...new Set(options.value.map(({ payment_acceptor }) => payment_acceptor?.id)),
        ].filter((id): id is string => !!id);

        return [
            'NO_PAYMENT_METHODS_AVAILABLE',
            ...(paymentAcceptorIds.length ? paymentAcceptorIds.sort() : ['no_payment_acceptor']),
        ];
    });

    watch(
        () => [availability.value, fingerprint.value.join('|')] as const,
        ([currentAvailability, currentFingerprint], previous) => {
            if (currentAvailability !== 'UNAVAILABLE') {
                return;
            }

            // Already reported, unless a different merchant is now the broken one.
            if (previous?.[0] === 'UNAVAILABLE' && previous[1] === currentFingerprint) {
                return;
            }

            const { invoiceId, subscriptionId } = toValue(context) ?? {};

            logger.error(
                'NO_PAYMENT_METHODS_AVAILABLE',
                'No payment method can be offered to the customer',
                {
                    fingerprint: fingerprint.value,
                    paymentAcceptorIds: options.value.map(
                        ({ payment_acceptor }) => payment_acceptor?.id,
                    ),
                    integrationIds: options.value.map(({ integration }) => integration?.id),
                    ...(invoiceId ? { invoiceId } : {}),
                    ...(subscriptionId ? { subscriptionId } : {}),
                },
            );
        },
        { immediate: true },
    );

    return { availability };
}
