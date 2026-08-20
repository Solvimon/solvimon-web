import type { Customer } from '@solvimon/solvimon-types';
import { computed, watch, type Ref } from 'vue';
import { getCustomerCountry } from '@solvimon/solvimon-ui';
import { usePaymentMethodOptions } from './usePaymentMethodOptions';

export function useCustomerPaymentMethodOptions({
    isOpen,
    customer,
}: {
    isOpen: Ref<boolean>;
    customer: Ref<Customer | undefined>;
}) {
    const { paymentMethodOptions, get, isPending } = usePaymentMethodOptions();

    watch(
        () => [isOpen.value, customer.value] as const,
        ([open, currentCustomer]) => {
            if (!open || !currentCustomer) {
                return;
            }

            void get({
                customerId: currentCustomer.id,
                country: getCustomerCountry(currentCustomer),
            });
        },
        { immediate: true },
    );

    /**
     * The options once the lookup has settled, and nothing while it is still out. They start empty,
     * so handing them over before the gateway has answered reads as "none available" every time.
     */
    const settledOptions = computed(() =>
        isPending.value ? undefined : paymentMethodOptions.value,
    );

    return { paymentMethodOptions, settledOptions, isPending };
}
