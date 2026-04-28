import type { ApiSuccessCollectionResponse, PricingPlanSubscription } from '@solvimon/solvimon-types';
import {
    serializeQueryParams,
    withExpand,
    withPagination,
    type WithPagination,
} from '@solvimon/ui';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

const ENDPOINT = '/portal/pricing-plan-subscriptions';

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
        const expandParams = expanded
            ? [
              'pricing_plan_schedule_infos.id',
              'pricing_plan_schedule_infos.pricing_plan_version_id',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_plan_id',
              'pricing_plan_schedule_infos.pricing_plan_version.credit_types',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.product_category_id',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricings.product_ids',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricings.entitlements.feature_id',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricings.items.configs.conditions.meter_properties.id',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricings.items.configs.wallet_grants.wallet_type_id',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricings.items.product_item_ids',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricings.items.product_items.usage_based.meter_value_calculation_id',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricings.items.product_items.usage_metric.meter_value_calculation.meter_value_id',
                  'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricings.items.product_items.usage_metric.meter_value_calculation.meter_id',
                  'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricings.items.product_items.usage_metric.meter_value_calculation.meter.meter_values.id',
                  'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricings.items.product_items.usage_metric.meter_value_calculation.meter.meter_properties',
                  'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricings.items.product_items.usage_metric.meter_value_calculation.meter.meter_properties.id',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricing_groups.pricings.product_ids',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricing_groups.pricings.items.configs.conditions.meter_properties.id',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricing_groups.pricings.items.configs.wallet_grants.wallet_type_id',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricing_groups.pricings.items.product_item_ids',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricing_groups.pricings.items.product_items.usage_based.meter_value_calculation_id',
              'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricing_groups.pricings.items.product_items.usage_metric.meter_value_calculation.meter_value_id',
                  'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricing_groups.pricings.items.product_items.usage_metric.meter_value_calculation.meter_id',
                  'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricing_groups.pricings.items.product_items.usage_metric.meter_value_calculation.meter.meter_values',
                  'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricing_groups.pricings.items.product_items.usage_metric.meter_value_calculation.meter.meter_values.id',
                  'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricing_groups.pricings.items.product_items.usage_metric.meter_value_calculation.meter.meter_properties',
                  'pricing_plan_schedule_infos.pricing_plan_version.pricing_categories.pricing_groups.pricings.items.product_items.usage_metric.meter_value_calculation.meter.meter_properties.id',
              ]
            : [];

        return request<PricingPlanSubscription>({
            url: `${config.apiUrls.config}${ENDPOINT}/${id}${serializeQueryParams(
                withExpand({ expandParams }),
            )}`,
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
            expandParams: [
                'pricing_plan_schedule_infos.pricing_plan_version_id',
                'pricing_plan_schedule_infos.pricing_plan_version.pricing_plan_id',
            ],
        });
        const queryString = serializeQueryParams(withPagination(queryWithExpand, paginationParams));

        return request<PricingPlanSubscriptionExpanded>({
            url: `${config.apiUrls.config}${ENDPOINT}${queryString}`,
            isCollection: true,
        });
    }

    return {
        getSubscription,
        getActiveSubscriptions,
    };
}
