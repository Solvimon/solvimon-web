import type { Customer, PricingPlanSubscription, QuoteVersion } from '@solvimon/solvimon-types';

type PortalUrlType =
    | 'INVOICE'
    | 'PAY_INVOICE'
    | 'CUSTOMER'
    | 'QUOTE_VERSION'
    | 'INIT_PRICING_PLAN_SUBSCRIPTION';

type PortalUrlStatus = 'PUBLISHED' | 'REVOKED';

export interface BasePortalUrl {
    object_type: 'PORTAL_URL';
    id: string;
    type: PortalUrlType;
    customer_id: Customer['id'];
    status: PortalUrlStatus;
    created_at: string; // ISO Timestamp
    embedded: boolean;
    token: string;
    url: string;
}

export interface PortalUrlInvoice extends BasePortalUrl {
    type: 'INVOICE';
    invoice: {
        id: string;
        options: {
            download_invoice: boolean;
            pay_open_invoice: boolean;
        };
        payment_acceptor_id: string;
    };
}

export interface PortalUrlPayInvoice extends BasePortalUrl {
    type: 'PAY_INVOICE';
    invoice: {
        id: string;
        options: {
            download_invoice: boolean;
            pay_open_invoice: boolean;
        };
        payment_acceptor_id: string;
    };
}

export interface PortalUrlQuoteVersion extends BasePortalUrl {
    type: 'QUOTE_VERSION';
    quote_version: {
        id: QuoteVersion['id'];
    };
}

export interface PortalUrlCustomer extends BasePortalUrl {
    type: 'CUSTOMER';
    customer: {
        display: {
            usage: boolean;
            invoices: boolean;
            pricing_plan_subscriptions: boolean;
            payment_acceptors: boolean;
        };
        options: {
            edit_customer_details: boolean;
            download_invoice: boolean;
            pay_open_invoice: boolean;
            combine_open_invoices: boolean;
        };
    };
}

export interface PortalUrlInitPricingPlanSubscription extends BasePortalUrl {
    type: 'INIT_PRICING_PLAN_SUBSCRIPTION';
    init_pricing_plan_subscription: {
        pricing_plan_subscription_id: PricingPlanSubscription['id'];
        success_url?: string;
    };
}

export type PortalUrl =
    | PortalUrlInvoice
    | PortalUrlPayInvoice
    | PortalUrlQuoteVersion
    | PortalUrlCustomer
    | PortalUrlInitPricingPlanSubscription;
