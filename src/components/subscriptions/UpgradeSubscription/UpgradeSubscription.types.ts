import type { Amount, BillingPeriod, Currency } from '@solvimon/solvimon-types';

export interface OnDemandProductItem {
    id?: string;
    name?: string;
}

export interface OnDemandPricing {
    id: string;
    name?: string;
    products?: Array<{ name?: string; description?: string }>;
    items?: Array<{
        id: string;
        product_items?: OnDemandProductItem[];
        configs?: Array<{
            bands?: Array<{
                amount?: Amount;
                fixed_amount?: Amount;
            }>;
        }>;
    }>;
}

export interface OnDemandPricingCategory {
    id?: string;
    name?: string;
    display_order?: number;
    product_category_id?: string;
    product_category?: {
        id?: string;
        name?: string;
    };
    pricings?: OnDemandPricing[];
    pricing_groups?: Array<{
        id: string;
        name: string;
        pricings: OnDemandPricing[];
    }>;
}

export interface OnDemandPricingItemsResponse {
    pricing_plan_subscription_id: string;
    pricing_plan_schedule_id: string;
    pricing_plan_version_id: string;
    billing_period?: BillingPeriod;
    billing_currency?: Currency['currencyCode'];
    pricing_categories?: OnDemandPricingCategory[] | null;
}
