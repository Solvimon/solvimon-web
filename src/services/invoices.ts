import type {
    ChargeOnDemandPricingItemsPayload,
    ChargeOnDemandPricingItemsPricingItemConfig,
    Customer,
    Invoice,
    InvoicePreview,
    PricingPlanSubscription,
    ApiSuccessCollectionResponse,
    PricingPlanSchedule,
    PricingPlanScheduleCustomization,
} from '@solvimon/solvimon-types';
import { downloadFile, withPagination } from '@solvimon/solvimon-ui';
import { createRequestService } from './requests';
import type { GetInvoicePreviewPayload } from './invoices.types';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

interface ChargeOnDemandPricingItemsPreviewPayload {
    pricingPlanScheduleId: PricingPlanSchedule['id'];
    /**
     * The items to preview. A flexible item — a wallet top-up for instance — also carries the
     * amount the customer chose; fixed items only need their id.
     */
    pricingItems: ChargeOnDemandPricingItemsPricingItemConfig[];
    startAt?: string;
}

interface InvoicesService {
    getInvoice: (invoiceId: Invoice['id']) => Promise<Invoice>;
    getInvoices: (args: {
        customerId: Customer['id'];
        pagination: {
            page?: number;
            pageSize?: number;
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
        };
        query?: Record<string, string | number | null | undefined>;
    }) => Promise<ApiSuccessCollectionResponse<Invoice>>;
    getInvoicePdf: (id: string) => Promise<void>;
    getInvoicePreview: (args: {
        customer: Partial<Customer>;
        pricingPlanSubscriptionId: PricingPlanSubscription['id'];
        startAt?: PricingPlanSchedule['start_at'];
        customizations?: PricingPlanScheduleCustomization[];
    }) => Promise<InvoicePreview>;
    previewChargeOnDemandPricingItems: (
        args: ChargeOnDemandPricingItemsPreviewPayload,
    ) => Promise<Invoice>;
    chargeOnDemandPricingItems: (payload: ChargeOnDemandPricingItemsPayload) => Promise<Invoice>;
}

export function createInvoicesService(): InvoicesService {
    const request = createRequestService();
    const config = useConfig();

    /** Previewing and charging on-demand pricing items share one endpoint. */
    const chargeOnDemandPricingItemsUrl = `${config.apiUrls.transaction}/portal/invoices/charge-on-demand-pricing-items`;

    /**
     * Get a single invoice
     */
    function getInvoice(invoiceId: Invoice['id']): Promise<Invoice> {
        return request<Invoice>({
            url: `${config.apiUrls.transaction}/portal/invoices/${invoiceId}`,
        });
    }

    function getInvoices({
        customerId,
        pagination,
        query,
    }: {
        customerId: Customer['id'];
        pagination: {
            page?: number;
            pageSize?: number;
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
        };
        query?: Record<string, string | number | null | undefined>;
    }): Promise<ApiSuccessCollectionResponse<Invoice>> {
        const queryParams = withPagination(
            {
                customer_id: customerId,
                ...(query ?? {}),
            },
            pagination,
        );

        const url = new URL(`${config.apiUrls.transaction}/portal/invoices`);

        Object.entries(queryParams).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                return;
            }

            if (Array.isArray(value)) {
                value.forEach((entry) => {
                    url.searchParams.append(`${key}[]`, `${entry}`);
                });
                return;
            }

            url.searchParams.append(key, `${value}`);
        });

        return request<Invoice>({
            url: url.toString(),
            isCollection: true,
        });
    }
    /**
     * Download the PDF version of the invoice.
     */
    async function getInvoicePdf(id: string): Promise<void> {
        return request<Blob>({
            url: `${config.apiUrls.transaction}/portal/invoices/${id}/pdf`,
            options: { headers: { 'Content-Type': 'application/pdf' } },
        }).then((response) => {
            const newBlob = new Blob([response], {
                type: 'application/pdf',
            });
            downloadFile(newBlob, `invoice-${id}.pdf`);
        });
    }

    /**
     * Get a preview of the invoice
     */
    function getInvoicePreview({
        customer,
        pricingPlanSubscriptionId,
        startAt,
        customizations,
        pricing_plan_schedule_customizations,
    }: GetInvoicePreviewPayload) {
        return request<InvoicePreview>({
            url: `${config.apiUrls.transaction}/portal/invoices/preview`,
            options: { method: 'POST' },
            data: {
                template_pricing_plan_subscription_id: pricingPlanSubscriptionId,
                ...(startAt && { start_at: startAt }),
                ...(customizations && { pricing_plan_schedule_customizations: customizations }),
                ...(pricing_plan_schedule_customizations && {
                    pricing_plan_schedule_customizations,
                }),
                customer_details: {
                    ...customer,
                    reference: 'preview',
                },
            },
        });
    }

    /**
     * POST /v1/portal/invoices/charge-on-demand-pricing-items
     *
     * Calculates what the selected on-demand pricing items would be invoiced for, without
     * creating anything.
     */
    function previewChargeOnDemandPricingItems({
        pricingPlanScheduleId,
        pricingItems,
        startAt,
    }: ChargeOnDemandPricingItemsPreviewPayload) {
        return request<Invoice>({
            url: chargeOnDemandPricingItemsUrl,
            options: { method: 'POST' },
            data: {
                pricing_plan_schedule_id: pricingPlanScheduleId,
                pricing_items: pricingItems,
                preview: true,
                ...(startAt ? { start_at: startAt } : {}),
            } satisfies ChargeOnDemandPricingItemsPayload,
        });
    }

    /**
     * POST /v1/portal/invoices/charge-on-demand-pricing-items
     *
     * Creates (and unless told otherwise, finalises) an invoice for the given on-demand pricing
     * items, and returns it.
     *
     * Passing `payment_method_id` (pmet_xxx) creates AND pays the invoice in a single call, so
     * the caller can show a success state directly. Omit it for new payment methods — the caller
     * should redirect to invoice-pay instead.
     */
    function chargeOnDemandPricingItems(payload: ChargeOnDemandPricingItemsPayload) {
        return request<Invoice>({
            url: chargeOnDemandPricingItemsUrl,
            options: { method: 'POST' },
            data: {
                finalize_immediately: true,
                ...payload,
            } satisfies ChargeOnDemandPricingItemsPayload,
        });
    }

    return {
        getInvoice,
        getInvoices,
        getInvoicePdf,
        getInvoicePreview,
        previewChargeOnDemandPricingItems,
        chargeOnDemandPricingItems,
    };
}
