import type {
    ApiSuccessCollectionResponse,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import { withExpand, withPagination, type WithPagination } from '@solvimon/solvimon-ui';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import { EXPAND_ALL } from '@/constants';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

const ENDPOINT = '/portal/pricing-plan-subscriptions';

export const SUBSCRIPTION_CANCELLATION_TYPES = {
    CANCEL: 'NEXT_BILLING_PERIOD',
    RENEW: 'UNDO',
} as const;

/** Which of the two the customer asked for. */
export type SubscriptionCancellationVariant = keyof typeof SUBSCRIPTION_CANCELLATION_TYPES;

interface SubscriptionsService {
    getSubscription(params: {
        id: PricingPlanSubscription['id'];
        expanded?: false;
    }): Promise<PricingPlanSubscription>;
    getSubscription(params: {
        id: PricingPlanSubscription['id'];
        expanded: true;
    }): Promise<PricingPlanSubscriptionExpanded>;
    getActiveSubscriptions(args: {
        customerId: string;
        pagination?: WithPagination<string>;
    }): Promise<ApiSuccessCollectionResponse<PricingPlanSubscriptionExpanded>>;
    setSubscriptionCancellation(params: {
        id: PricingPlanSubscription['id'];
        variant: SubscriptionCancellationVariant;
    }): Promise<PricingPlanSubscription>;
}

export function createSubscriptionsService(): SubscriptionsService {
    const config = useConfig();
    const request = createRequestService();

    /**
     * Get a subscription by id.
     */
    function getSubscription(params: {
        id: PricingPlanSubscription['id'];
        expanded?: false;
    }): Promise<PricingPlanSubscription>;
    function getSubscription(params: {
        id: PricingPlanSubscription['id'];
        expanded: true;
    }): Promise<PricingPlanSubscriptionExpanded>;
    function getSubscription({
        id,
        expanded = false,
    }: {
        id: PricingPlanSubscription['id'];
        expanded?: boolean;
    }): Promise<PricingPlanSubscription | PricingPlanSubscriptionExpanded> {
        return request<PricingPlanSubscription>({
            url: `${config.apiUrls.config}${ENDPOINT}/${id}`,
            query: withExpand({ expandParams: EXPAND_ALL, expand: expanded }),
        });
    }

    function getActiveSubscriptions({
        customerId,
        pagination,
    }: {
        customerId: string;
        pagination?: WithPagination<string>;
    }): Promise<ApiSuccessCollectionResponse<PricingPlanSubscriptionExpanded>> {
        const paginationParams: WithPagination<string> = pagination ?? {};
        const queryWithExpand = withExpand({
            initialParams: {
                customer_id: customerId,
                statuses: ['ACTIVE'],
                type: 'BILLING',
            },
            expandParams: EXPAND_ALL,
        });
        return request<PricingPlanSubscriptionExpanded>({
            url: `${config.apiUrls.config}${ENDPOINT}`,
            query: withPagination(queryWithExpand, paginationParams),
            isCollection: true,
        });
    }

    function setSubscriptionCancellation({
        id,
        variant,
    }: {
        id: PricingPlanSubscription['id'];
        variant: SubscriptionCancellationVariant;
    }): Promise<PricingPlanSubscription> {
        return request<PricingPlanSubscription>({
            url: `${config.apiUrls.config}${ENDPOINT}/${id}/cancel`,
            data: { type: SUBSCRIPTION_CANCELLATION_TYPES[variant] },
            options: { method: 'POST' },
        });
    }

    return {
        getSubscription,
        getActiveSubscriptions,
        setSubscriptionCancellation,
    };
}
