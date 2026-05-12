import type { CustomerPortalUrl } from '@solvimon/solvimon-types';

export const createTestPortalObject = (customerId = 'cus_123'): CustomerPortalUrl => ({
    object_type: 'PORTAL_URL',
    id: 'purl_example',
    type: 'CUSTOMER',
    customer_id: customerId,
    token: 'test-portal-token',
    status: 'PUBLISHED',
    created_at: '2024-01-01T00:00:00Z',
    embedded: false,
    url: 'https://example.com/portal',
    customer: {
        display: {
            usage: true,
            invoices: true,
            pricing_plan_subscriptions: true,
            payment_acceptors: true,
        },
        options: {
            edit_customer_details: true,
            download_invoice: true,
            pay_open_invoice: true,
            combine_open_invoices: true,
        },
    },
    widgets: {
        usage: '',
        invoices: '',
        pricing_plan_subscriptions: '',
    },
});
