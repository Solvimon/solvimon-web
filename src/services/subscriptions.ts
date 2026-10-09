import type {
    ApiSuccessCollectionResponse,
    BillingPeriod,
    PricingPlan,
    PricingPlanSchedule,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import { withExpand, withPagination, type WithPagination } from '@solvimon/solvimon-ui';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import { EXPAND_ALL } from '@/constants';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import type { PricingPlanGroup } from '@/types/pricingPlanGroup';

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
    changeSubscriptionPlan(params: ChangeSubscriptionPlanPayload): Promise<PricingPlanSchedule>;
    getSubscriptionPricingPlanGroup(params: {
        id: PricingPlanSubscription['id'];
    }): Promise<PricingPlanGroup>;
}

export interface ChangeSubscriptionPlanPayload {
    id: PricingPlanSubscription['id'];
    /** A sibling of the subscription's current plan within the same pricing plan group. */
    pricingPlanId: PricingPlan['id'];
    /**
     * Only when the customer moves to a different billing period as well; left out, the current
     * one is kept. Must be one the target plan version offers.
     */
    billingPeriod?: BillingPeriod;
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

    /**
     * GET /v1/portal/pricing-plan-subscriptions/{id}/pricing-plan-group
     *
     * The group holding the plan the subscription's current schedule runs on — the plans it may
     * move between and how each move is timed. Asked of the subscription rather than of the plan,
     * since nothing on a plan points back at the group that holds it.
     *
     * Expanded, so a member carries the plan it names and the screen has something to label the
     * option with; a response that expands nothing is read by its ids instead.
     */
    function getSubscriptionPricingPlanGroup({
        id,
    }: {
        id: PricingPlanSubscription['id'];
    }): Promise<PricingPlanGroup> {
        return request<PricingPlanGroup>({
            url: `${config.apiUrls.config}${ENDPOINT}/${id}/pricing-plan-group`,
            query: withExpand({ expandParams: EXPAND_ALL }),
            // A subscription on a plan that belongs to no group is the common case, not a failure.
            options: { expectedStatusCodes: [404] },
        });
    }

    /**
     * POST /v1/portal/pricing-plan-subscriptions/{id}/change-plan
     *
     * Moves the subscription to another plan in the same pricing plan group (MD-5064). The group
     * decides when the move takes effect, so no start date is sent: the API defaults it to now for
     * the immediate timings and rejects one outright for `NEXT_BILLING_PERIOD`.
     */
    function changeSubscriptionPlan({
        id,
        pricingPlanId,
        billingPeriod,
    }: ChangeSubscriptionPlanPayload): Promise<PricingPlanSchedule> {
        return request<PricingPlanSchedule>({
            url: `${config.apiUrls.config}${ENDPOINT}/${id}/change-plan`,
            data: {
                pricing_plan_id: pricingPlanId,
                ...(billingPeriod && { billing_period: billingPeriod }),
            },
            options: { method: 'POST' },
        });
    }

    return {
        getSubscription,
        getActiveSubscriptions,
        setSubscriptionCancellation,
        changeSubscriptionPlan,
        getSubscriptionPricingPlanGroup,
    };
}
