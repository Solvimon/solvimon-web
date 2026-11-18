import { ref, type Ref } from 'vue';
import { useLogger } from '@/components/providers';
import { createSubscriptionsService } from '@/services/subscriptions';

/**
 * Whether the customer has a self-billing subscription, of any status: the customers who are paid
 * into bank accounts of their own and so have payment acceptors to look after.
 */
export function useHasSelfBillingSubscription({ customerId }: { customerId: string | undefined }): {
    hasSelfBillingSubscription: Ref<boolean>;
    check: () => Promise<void>;
} {
    const service = createSubscriptionsService();
    const logger = useLogger();

    const hasSelfBillingSubscription = ref(false);

    /** Never rejects: an answer it cannot get leaves the payment acceptors out. */
    const check = async () => {
        if (!customerId) return;

        try {
            const { data } = await service.getSubscriptionsOfVariant({
                customerId,
                variant: 'SELF_BILLING',
                pageSize: 1,
            });
            hasSelfBillingSubscription.value = data.length > 0;
        } catch (error) {
            logger.error(
                'SELF_BILLING_SUBSCRIPTIONS_LOAD_FAILED',
                'Failed to find out whether the customer has self-billing subscriptions',
                {},
                error,
            );
        }
    };

    return { hasSelfBillingSubscription, check };
}
