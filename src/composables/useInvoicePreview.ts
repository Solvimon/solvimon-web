import {
    ApiStatus,
    type Address,
    type Invoice,
    type Pricing,
    type PricingPlanSchedule,
    type PricingPlanSubscriptionExpanded,
} from '@solvimon/types';
import type { TimePeriod } from '@solvimon/types';
import { computed, ref } from 'vue';
import { convertDateRangeToTimePeriod } from '@solvimon/ui';
import { taxId } from '@solvimon/ui/validators';
import { isEqual } from 'lodash';
import { createInvoicesService } from '@/services/invoices';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { getScheduleCustomizations } from '@/utils/pricingPlanSchedule';
import type { GetInvoicePreviewPayload } from '@/services/invoices.types';

const EMPTY_LEGAL_ENTITY_NAME = 'preview';
const EMPTY_COUNTRY = 'NL';

export const useInvoicePreview = () => {
    const { getInvoicePreview } = createInvoicesService();

    const trialPeriod = ref<TimePeriod>();
    const trialInvoicePreview = ref<Invoice>();
    const invoicePreview = ref<Invoice>();
    const status = ref<ApiStatus>(ApiStatus.Initial);
    const cachedPreviewPayload = ref<GetInvoicePreviewPayload>();
    const lastPreviewScheduleId = ref<string>();

    const loadInvoicePreview = async ({
        subscription,
        subscriptionStartAt,
        checkoutForm,
        enabledPricingIds,
        promotionCode,
    }: {
        subscription: PricingPlanSubscriptionExpanded;
        subscriptionStartAt?: PricingPlanSchedule['start_at'];
        checkoutForm: CheckoutFormState;
        enabledPricingIds?: Pricing['id'][];
        promotionCode?: string | null;
    }) => {
        const address = {
            ...(checkoutForm.addressLine1 && { line1: checkoutForm.addressLine1 }),
            ...(checkoutForm.addressLine2 && { line2: checkoutForm.addressLine2 }),
            ...(checkoutForm.city && { city: checkoutForm.city }),
            ...(checkoutForm.state && { state: checkoutForm.state }),
            ...(checkoutForm.country
                ? { country: checkoutForm.country || EMPTY_COUNTRY }
                : { country: EMPTY_COUNTRY }),
            ...(checkoutForm.postalCode && { postal_code: checkoutForm.postalCode }),
        } satisfies Partial<Address>;

        status.value = ApiStatus.Loading;

        const scheduleCustomizations =
            getScheduleCustomizations({
                enabledPricings: enabledPricingIds?.map((enabledPricingId) => ({
                    pricing_id: enabledPricingId,
                })),
                seatsValues: checkoutForm.seatsValues,
                pricingPlanScheduleInfos: subscription.pricing_plan_schedule_infos,
            }) ?? [];

        if (promotionCode) {
            const defaultScheduleId = subscription.pricing_plan_schedule_infos.find(
                ({ pricing_plan_schedule }) => pricing_plan_schedule.type === 'DEFAULT',
            )?.id;

            if (defaultScheduleId) {
                const existingCustomization = scheduleCustomizations.find(
                    ({ pricing_plan_schedule_id }) =>
                        pricing_plan_schedule_id === defaultScheduleId,
                );

                if (existingCustomization) {
                    existingCustomization.promotion_codes = [promotionCode];
                } else {
                    scheduleCustomizations.push({
                        pricing_plan_schedule_id: defaultScheduleId,
                        promotion_codes: [promotionCode],
                    });
                }
            }
        }

        const payload = {
            pricingPlanSubscriptionId: subscription.id,
            startAt: subscriptionStartAt,
            customizations: scheduleCustomizations,
            customer: {
                type: checkoutForm.type || 'INDIVIDUAL',
                ...(checkoutForm.type === 'INDIVIDUAL' && {
                    individual: {
                        residential_address: address,
                    },
                }),
                ...(checkoutForm.type === 'ORGANIZATION' && {
                    organization: {
                        legal_name: checkoutForm.companyLegalName || EMPTY_LEGAL_ENTITY_NAME,
                        registered_address: address,
                        ...(checkoutForm.companyVatNumber && {
                            tax_id: taxId.$validator(checkoutForm.companyVatNumber, {}, {})
                                ? checkoutForm.companyVatNumber
                                : undefined,
                        }),
                    },
                }),
            },
        } satisfies GetInvoicePreviewPayload;

        if (isEqual(payload, cachedPreviewPayload.value)) {
            return;
        }

        cachedPreviewPayload.value = payload;

        try {
            const invoicePreviewResponse = await getInvoicePreview(payload);

            lastPreviewScheduleId.value =
                invoicePreviewResponse.invoice_infos.at(-1)?.pricing_plan_schedule_id;

            const trialSchedule = subscription?.pricing_plan_schedule_infos.find(
                ({ pricing_plan_schedule }) => pricing_plan_schedule.type === 'TRIAL',
            );

            if (trialSchedule) {
                trialInvoicePreview.value = invoicePreviewResponse.first_invoice;

                if (trialSchedule.start_at && trialSchedule.end_at) {
                    trialPeriod.value = convertDateRangeToTimePeriod(
                        new Date(trialSchedule.start_at),
                        new Date(trialSchedule.end_at),
                    );
                }
            }

            const invoiceScheduleId = subscription?.pricing_plan_schedule_infos.find(
                ({ pricing_plan_schedule }) => pricing_plan_schedule.type === 'DEFAULT',
            )?.id;

            const invoiceInfo = invoicePreviewResponse.invoice_infos.find(
                ({ pricing_plan_schedule_id }) => pricing_plan_schedule_id === invoiceScheduleId,
            );

            invoicePreview.value = invoiceInfo?.invoices[0];
        } catch (error) {
            status.value = ApiStatus.Failed;
            throw error;
        } finally {
            status.value = ApiStatus.Done;
        }
    };

    return {
        loadInvoicePreview,
        invoicePreview,
        trialInvoicePreview,
        trialPeriod,
        lastPreviewScheduleId,
        isPending: computed(() => status.value === ApiStatus.Loading),
    };
};
