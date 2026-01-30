import type {
    Customer,
    Invoice,
    InvoicePreview,
    PricingPlanSubscription,
    ApiSuccessCollectionResponse,
    PricingPlanSchedule,
    PricingPlanScheduleCustomization,
} from '@solvimon/types';
import { downloadFile, withPagination } from '@solvimon/ui';
import { createRequestService } from './requests';
import type { GetInvoicePreviewPayload } from './invoices.types';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

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
}

export function createInvoicesService(): InvoicesService {
    const request = createRequestService();
    const config = useConfig();

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
            const newBlob = new Blob([response as BlobPart], {
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
    }: GetInvoicePreviewPayload) {
        return request<InvoicePreview>({
            url: `${config.apiUrls.transaction}/portal/invoices/preview`,
            options: { method: 'POST' },
            data: {
                template_pricing_plan_subscription_id: pricingPlanSubscriptionId,
                ...(startAt && { start_at: startAt }),
                ...(customizations && { pricing_plan_schedule_customizations: customizations }),
                customer_details: {
                    ...customer,
                    reference: 'preview',
                },
            },
        });
    }

    return {
        getInvoice,
        getInvoices,
        getInvoicePdf,
        getInvoicePreview,
    };
}
