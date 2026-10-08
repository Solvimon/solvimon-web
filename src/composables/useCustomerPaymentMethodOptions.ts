import type { Customer, PricingPlanSubscription } from '@solvimon/solvimon-types';
import { computed, watch, type Ref } from 'vue';
import { getCustomerCountry } from '@solvimon/solvimon-ui';
import { usePaymentMethodOptions } from './usePaymentMethodOptions';

export function useCustomerPaymentMethodOptions({
    isOpen,
    customer,
    subscriptionId,
    onError,
}: {
    isOpen: Ref<boolean>;
    customer: Ref<Customer | undefined>;
    /** Narrows the options to what the subscription accepts. */
    subscriptionId?: Ref<PricingPlanSubscription['id'] | undefined>;
    onError?: (error: unknown) => void;
}) {
    const { paymentMethodOptions, get, isPending } = usePaymentMethodOptions();

    /**
     * Looks the options up for the current customer, once it is open and the customer has loaded:
     * the country decides which methods the gateway offers, so asking without it gets the wrong
     * ones. A lookup that already succeeded is answered from what is held.
     */
    const load = async (): Promise<void> => {
        const currentCustomer = customer.value;

        if (!isOpen.value || !currentCustomer) {
            return;
        }

        try {
            await get({
                customerId: currentCustomer.id,
                ...(subscriptionId?.value ? { subscriptionId: subscriptionId.value } : {}),
                country: getCustomerCountry(currentCustomer),
            });
        } catch (error) {
            onError?.(error);
        }
    };

    watch(
        () => [isOpen.value, customer.value, subscriptionId?.value] as const,
        () => void load(),
        { immediate: true },
    );

    /**
     * The options once the lookup has settled, and nothing while it is still out. They start empty,
     * so handing them over before the gateway has answered reads as "none available" every time.
     */
    const settledOptions = computed(() =>
        isPending.value ? undefined : paymentMethodOptions.value,
    );

    return { paymentMethodOptions, settledOptions, isPending, load };
}
