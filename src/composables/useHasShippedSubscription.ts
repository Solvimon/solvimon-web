import type { PricingPlanSubscription } from '@solvimon/solvimon-types';
import { ref, type Ref } from 'vue';
import { useLogger } from '@/components/providers';
import { createSubscriptionsService } from '@/services/subscriptions';

/** Enough for nearly every customer to be answered in one request. */
const PAGE_SIZE = 50;

const ships = ({ default_shipping_address_id }: PricingPlanSubscription) =>
    Boolean(default_shipping_address_id);

/**
 * Whether the customer has a subscription, of any status, that ships to a shipping address: the
 * customers who have shipping addresses to look after.
 */
export function useHasShippedSubscription({ customerId }: { customerId: string | undefined }): {
    hasShippedSubscription: Ref<boolean>;
    check: (loaded?: PricingPlanSubscription[]) => Promise<void>;
} {
    const service = createSubscriptionsService();
    const logger = useLogger();

    const hasShippedSubscription = ref(false);

    /**
     * Looks at the subscriptions already loaded first, which settles it for nearly every customer
     * whose order ships, then reads the rest page by page. Never rejects: an answer it cannot get
     * leaves the shipping addresses out.
     */
    const check = async (loaded: PricingPlanSubscription[] = []) => {
        if (loaded.some(ships)) {
            hasShippedSubscription.value = true;
            return;
        }

        if (!customerId) return;

        try {
            for (let page = 1; ; page += 1) {
                const { data, links } = await service.getSubscriptionsOfEveryStatus({
                    customerId,
                    page,
                    pageSize: PAGE_SIZE,
                });

                if (data.some(ships)) {
                    hasShippedSubscription.value = true;
                    return;
                }

                if (!links?.next || !data.length) return;
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
