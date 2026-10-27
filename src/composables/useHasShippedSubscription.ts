import { ref, type Ref } from 'vue';
import { useLogger } from '@/components/providers';
import { createSubscriptionsService } from '@/services/subscriptions';

/** Enough for nearly every customer to be answered in one request. */
const PAGE_SIZE = 50;

/**
 * Whether the customer has a subscription, of any status, that ships to a shipping address: the
 * customers who have shipping addresses to look after.
 */
export function useHasShippedSubscription({ customerId }: { customerId: string | undefined }): {
    hasShippedSubscription: Ref<boolean>;
    check: () => Promise<void>;
} {
    const service = createSubscriptionsService();
    const logger = useLogger();

    const hasShippedSubscription = ref(false);

    /** Never rejects: an answer it cannot get leaves the shipping addresses out. */
    const check = async () => {
        if (!customerId) return;

        try {
            for (let page = 1; ; page += 1) {
                const { data } = await service.getSubscriptionsOfEveryStatus({
                    customerId,
                    page,
                    pageSize: PAGE_SIZE,
                });

                if (data.some(({ default_shipping_address_id }) => default_shipping_address_id)) {
                    hasShippedSubscription.value = true;
                    return;
                }

                if (data.length < PAGE_SIZE) return;
            }
        } catch (error) {
            logger.error(
                'SHIPPED_SUBSCRIPTIONS_LOAD_FAILED',
                'Failed to find out whether the customer has shipped subscriptions',
                {},
                error,
            );
        }
    };

    return { hasShippedSubscription, check };
}
