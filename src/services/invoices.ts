import type {
    Customer,
    Invoice,
    InvoicePreview,
    Pricing,
    PricingPlanSubscription,
    ApiSuccessCollectionResponse,
} from '@solvimon/types';
import { downloadFile, withPagination } from '@solvimon/ui';
import { createRequestService } from './requests';
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
        enabledPricingIds?: Pricing['id'][];
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
            pagination
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
            options: {
                headers: { 'Content-Type': 'application/pdf' },
            },
        }).then((response) => {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
        enabledPricingIds,
    }: {
        customer: Partial<Customer>;
        pricingPlanSubscriptionId: PricingPlanSubscription['id'];
        enabledPricingIds?: Pricing['id'][];
    }) {
        return request<InvoicePreview>({
            url: `${config.apiUrls.transaction}/portal/invoices/preview`,
            options: {
                method: 'POST',
            },
            data: {
                template_pricing_plan_subscription_id: pricingPlanSubscriptionId,
                ...(enabledPricingIds && {
                    enabled_pricings: enabledPricingIds.map((enabledPricingId) => ({
                        pricing_id: enabledPricingId,
                    })),
                }),
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
