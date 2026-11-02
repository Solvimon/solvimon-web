import type {
    ApiSuccessCollectionResponse,
    PaymentMethod,
    PricingPlan,
    PricingPlanSchedule,
    PricingPlanSubscription,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import { withExpand, withPagination, type WithPagination } from '@solvimon/solvimon-ui';
import { createRequestService } from './requests';
import { buildUrl } from './requests.lib';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import { EXPAND_ALL } from '@/constants';
import type { PricingPlanGroup } from '@/types/pricingPlanGroup';

const ENDPOINT = ['portal', 'pricing-plan-subscriptions'];

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
    getSubscriptionsOfEveryStatus(args: {
        customerId: string;
        page: number;
        pageSize: number;
    }): Promise<ApiSuccessCollectionResponse<PricingPlanSubscription>>;
    setSubscriptionCancellation(params: {
        id: PricingPlanSubscription['id'];
        variant: SubscriptionCancellationVariant;
    }): Promise<PricingPlanSubscription>;
    changeSubscriptionPlan(params: ChangeSubscriptionPlanPayload): Promise<PricingPlanSchedule>;
    setSubscriptionPaymentMethod(params: {
        id: PricingPlanSubscription['id'];
        paymentMethodId: PaymentMethod['id'];
    }): Promise<PricingPlanSubscription>;
    getSubscriptionPricingPlanGroup(params: {
        id: PricingPlanSubscription['id'];
    }): Promise<PricingPlanGroup>;
}

export interface ChangeSubscriptionPlanPayload {
    id: PricingPlanSubscription['id'];
    /** Another plan in the group of the subscription's current plan. */
    pricingPlanId: PricingPlan['id'];
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
    async function getSubscription({
        id,
        expanded = false,
    }: {
        id: PricingPlanSubscription['id'];
        expanded?: boolean;
    }): Promise<PricingPlanSubscription | PricingPlanSubscriptionExpanded> {
        return request<PricingPlanSubscription>({
            url: buildUrl(config.apiUrls.config, ...ENDPOINT, id),
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
            url: buildUrl(config.apiUrls.config, ...ENDPOINT),
            query: withPagination(queryWithExpand, paginationParams),
            isCollection: true,
        });
    }

    /** A page of the customer's subscriptions, whatever their status, without expansions. */
    function getSubscriptionsOfEveryStatus({
        customerId,
        page,
        pageSize,
    }: {
        customerId: string;
        page: number;
        pageSize: number;
    }): Promise<ApiSuccessCollectionResponse<PricingPlanSubscription>> {
        return request<PricingPlanSubscription>({
            url: buildUrl(config.apiUrls.config, ...ENDPOINT),
            query: withPagination({ customer_id: customerId }, { page, pageSize }),
            isCollection: true,
        });
    }

    async function setSubscriptionCancellation({
        id,
        variant,
    }: {
        id: PricingPlanSubscription['id'];
        variant: SubscriptionCancellationVariant;
    }): Promise<PricingPlanSubscription> {
        return request<PricingPlanSubscription>({
            url: buildUrl(config.apiUrls.config, ...ENDPOINT, id, 'cancel'),
            data: { type: SUBSCRIPTION_CANCELLATION_TYPES[variant] },
            options: { method: 'POST' },
        });
    }

    /**
     * The group holding the plan the subscription runs on. Asked of the subscription, since nothing
     * on a plan points back at its group; expanded, so each member carries its plan.
     */
    function getSubscriptionPricingPlanGroup({
        id,
    }: {
        id: PricingPlanSubscription['id'];
    }): Promise<PricingPlanGroup> {
        return request<PricingPlanGroup>({
            url: buildUrl(config.apiUrls.config, ...ENDPOINT, id, 'pricing-plan-group'),
            query: withExpand({ expandParams: EXPAND_ALL }),
            // A subscription on a plan that belongs to no group is the common case, not a failure.
            options: { expectedStatusCodes: [404] },
        });
    }

    /**
     * The group decides when the move takes effect, so no start date is sent: the API defaults it
     * to now for the immediate timings and rejects one for `NEXT_BILLING_PERIOD`.
     */
    function changeSubscriptionPlan({
        id,
        pricingPlanId,
    }: ChangeSubscriptionPlanPayload): Promise<PricingPlanSchedule> {
        return request<PricingPlanSchedule>({
            url: buildUrl(config.apiUrls.config, ...ENDPOINT, id, 'change-plan'),
            data: { pricing_plan_id: pricingPlanId },
            options: { method: 'POST' },
        });
    }

    /** The linked method pays what the subscription is billed from then on, not just one change. */
    function setSubscriptionPaymentMethod({
        id,
        paymentMethodId,
    }: {
        id: PricingPlanSubscription['id'];
        paymentMethodId: PaymentMethod['id'];
    }): Promise<PricingPlanSubscription> {
        return request<PricingPlanSubscription>({
            url: buildUrl(config.apiUrls.config, ...ENDPOINT, id, 'update-payment-method'),
            data: { payment_method_id: paymentMethodId },
            options: { method: 'POST' },
        });
    }

    return {
        setSubscriptionPaymentMethod,
        getSubscription,
        getActiveSubscriptions,
        getSubscriptionsOfEveryStatus,
        setSubscriptionCancellation,
        changeSubscriptionPlan,
        getSubscriptionPricingPlanGroup,
    };
}
