import type {
    ChargeOnDemandPricingItemsPayload,
    ChargeOnDemandPricingItemsPricingItemConfig,
    Invoice,
    InvoicePreview,
    ApiSuccessCollectionResponse,
    PricingPlanSchedule,
} from '@solvimon/solvimon-types';
import { downloadFile, withPagination } from '@solvimon/solvimon-ui';
import { createRequestService } from './requests';
import { isRejectedPromotionCode } from './apiError';
import { buildUrl } from './requests.lib';
import type { GetInvoicePreviewPayload } from './invoices.types';
import type { ChangeSubscriptionPlanPayload } from './subscriptions';
import type { CustomerCollectionPayload } from './requests.types';
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
    getInvoices: (
        args: CustomerCollectionPayload,
    ) => Promise<ApiSuccessCollectionResponse<Invoice>>;
    getInvoicePdf: (invoice: Pick<Invoice, 'id' | 'invoice_number'>) => Promise<void>;
    getInvoicePreview: (args: GetInvoicePreviewPayload) => Promise<InvoicePreview>;
    getChangePlanInvoicePreview: (args: ChangeSubscriptionPlanPayload) => Promise<Invoice>;
    previewChargeOnDemandPricingItems: (
        args: ChargeOnDemandPricingItemsPreviewPayload,
    ) => Promise<Invoice>;
    chargeOnDemandPricingItems: (payload: ChargeOnDemandPricingItemsPayload) => Promise<Invoice>;
}

export function createInvoicesService(): InvoicesService {
    const request = createRequestService();
    const config = useConfig();

    /** Previewing and charging on-demand pricing items share one endpoint. */
    const chargeOnDemandPricingItemsUrl = buildUrl(
        config.apiUrls.transaction,
        'portal',
        'invoices',
        'charge-on-demand-pricing-items',
    );

    /**
     * Get a single invoice
     */
    async function getInvoice(invoiceId: Invoice['id']): Promise<Invoice> {
        return request<Invoice>({
            url: buildUrl(config.apiUrls.transaction, 'portal', 'invoices', invoiceId),
        });
    }

    function getInvoices({
        customerId,
        pagination,
        query,
    }: CustomerCollectionPayload): Promise<ApiSuccessCollectionResponse<Invoice>> {
        const queryParams = withPagination(
            {
                customer_id: customerId,
                ...(query ?? {}),
            },
            pagination,
        );

        return request<Invoice>({
            url: buildUrl(config.apiUrls.transaction, 'portal', 'invoices'),
            query: queryParams,
            isCollection: true,
        });
    }
    /**
     * Download the PDF version of the invoice. The file is named after the invoice number the
     * customer sees on the document itself; an invoice still waiting for one falls back to its id
     * so the file is never named `invoice-.pdf`.
     */
    async function getInvoicePdf({
        id,
        invoice_number,
    }: Pick<Invoice, 'id' | 'invoice_number'>): Promise<void> {
        return request<Blob>({
            url: buildUrl(config.apiUrls.transaction, 'portal', 'invoices', id, 'pdf'),
            options: { headers: { Accept: 'application/pdf', 'Content-Type': null } },
        }).then((response) => {
            const newBlob = new Blob([response], {
                type: 'application/pdf',
            });
            downloadFile(newBlob, `invoice-${invoice_number || id}.pdf`);
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
        forExistingSubscription = false,
    }: GetInvoicePreviewPayload) {
        return request<InvoicePreview>({
            url: buildUrl(config.apiUrls.transaction, 'portal', 'invoices', 'preview'),
            options: { method: 'POST', isExpectedError: isRejectedPromotionCode },
            data: {
                // A subscription that is already running is priced as itself, and its customer is
                // known. One that does not exist yet is priced off the template it would be created
                // from, for the details it would be invoiced to.
                ...(forExistingSubscription
                    ? { pricing_plan_subscription_id: pricingPlanSubscriptionId }
                    : {
                          template_pricing_plan_subscription_id: pricingPlanSubscriptionId,
                          customer_details: {
                              ...customer,
                              reference: 'preview',
                          },
                      }),
                ...(startAt && { start_at: startAt }),
                ...(customizations && { pricing_plan_schedule_customizations: customizations }),
                ...(pricing_plan_schedule_customizations && {
                    pricing_plan_schedule_customizations,
                }),
            },
        });
    }

    /**
     * POST /v1/portal/invoices/charge-on-demand-pricing-items
     *
     * Calculates what the selected on-demand pricing items would be invoiced for, without
     * creating anything.
     */
    /**
     * POST /v1/portal/invoices/change-plan/preview
     *
     * The invoice a move to another plan in the group would raise at the start of the new
     * schedule, without moving the subscription. It takes what change-plan takes, plus the
     * subscription, so the API resolves the timing exactly as the move itself would.
     */
    function getChangePlanInvoicePreview({
        id,
        pricingPlanId,
        billingPeriod,
    }: ChangeSubscriptionPlanPayload): Promise<Invoice> {
        return request<Invoice>({
            url: buildUrl(
                config.apiUrls.transaction,
                'portal',
                'invoices',
                'change-plan',
                'preview',
            ),
            options: { method: 'POST' },
            data: {
                pricing_plan_subscription_id: id,
                pricing_plan_id: pricingPlanId,
                ...(billingPeriod && { billing_period: billingPeriod }),
            },
        });
    }

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
        getChangePlanInvoicePreview,
        previewChargeOnDemandPricingItems,
        chargeOnDemandPricingItems,
    };
}
