import { ApiStatus, type BillingPeriod, type Invoice } from '@solvimon/solvimon-types';
import type { TimePeriod } from '@solvimon/solvimon-types';
import { computed, ref } from 'vue';
import { convertDateRangeToTimePeriod } from '@solvimon/solvimon-ui';
import { isEqual } from '@solvimon/solvimon-ui';
import { buildCustomerPayload, getCustomerAddress } from './useInvoicePreview.lib';
import type { LoadInvoicePreviewParams } from './useInvoicePreview.types';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { createInvoicesService } from '@/services/invoices';
import {
    getFirstPricingPlanScheduleOfType,
    getScheduleCustomizations,
} from '@/utils/pricingPlanSchedule';
import { getPricingCurrencyForCountry } from '@/utils/countryCurrency';
import type { GetInvoicePreviewPayload } from '@/services/invoices.types';

export const useInvoicePreview = () => {
    const { getInvoicePreview } = createInvoicesService();
    const logger = useLogger();

    const trialPeriod = ref<TimePeriod>();
    const trialInvoicePreview = ref<Invoice>();
    const invoicePreview = ref<Invoice>();
    const invoicePreviewByBillingPeriod = ref<Record<string, Invoice>>({});
    const status = ref<ApiStatus>(ApiStatus.Initial);
    const cachedPreviewPayloads = ref<Record<string, GetInvoicePreviewPayload>>({});
    const lastPreviewScheduleId = ref<string>();

    const getBillingPeriodKey = (period: BillingPeriod) => `${period.type}:${period.value}`;

    const loadInvoicePreview = async ({
        subscription,
        subscriptionStartAt,
        customer = {},
        seatsValues,
        enabledPricingIds,
        promotionCode,
    }: LoadInvoicePreviewParams) => {
        const customerPayload = buildCustomerPayload(customer);

        status.value = ApiStatus.Loading;

        const scheduleInfo = getFirstPricingPlanScheduleOfType({
            pricingPlanScheduleInfos: subscription.pricing_plan_schedule_infos,
            type: 'DEFAULT',
        });

        const pricingCurrencySettings =
            scheduleInfo?.pricing_plan_version?.pricing_currency_settings;
        const hasMultiplePricingCurrencies =
            (pricingCurrencySettings?.pricing_currencies?.length ?? 0) > 1;

        const billingPeriods =
            scheduleInfo?.pricing_plan_version?.billing_period_settings?.billing_periods ?? [];
        const hasMultipleBillingPeriods = billingPeriods.length > 1;

        const periodsForPreview =
            billingPeriods.length > 0
                ? billingPeriods.map(({ period }) => period)
                : subscription.billing_period
                  ? [subscription.billing_period]
                  : [];

        const pricingCurrency = getPricingCurrencyForCountry({
            country: getCustomerAddress(customer)?.country,
            pricingCurrencySettings,
            fallbackCurrency: subscription.billing_currency,
        });

        // Nothing to price against: the plan version lists no billing periods and the subscription
        // carries none either. Reported, since otherwise no request is made and no error is raised.
        if (!periodsForPreview.length) {
            logger.warn('INVOICE_PREVIEW_SKIPPED', 'No billing period to preview an invoice for', {
                subscriptionId: subscription.id,
            });
            status.value = ApiStatus.Done;
            return;
        }

        const selectedPeriodKey = subscription.billing_period
            ? getBillingPeriodKey(subscription.billing_period)
            : getBillingPeriodKey(periodsForPreview[0]);

        const previewPromises = periodsForPreview.map(async (period) => {
            const periodKey = getBillingPeriodKey(period);

            const scheduleCustomizations =
                getScheduleCustomizations({
                    enabledPricings: enabledPricingIds?.map((enabledPricingId) => ({
                        pricing_id: enabledPricingId,
                    })),
                    seatsValues,
                    pricingPlanScheduleInfos: subscription.pricing_plan_schedule_infos,
                    pricingCurrency: hasMultiplePricingCurrencies ? pricingCurrency : undefined,
                    billingPeriod: hasMultipleBillingPeriods ? period : undefined,
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
                customer: customerPayload,
            } satisfies GetInvoicePreviewPayload;

            const cachedPayload = cachedPreviewPayloads.value[periodKey];
            if (cachedPayload && isEqual(payload, cachedPayload)) {
                return { periodKey, response: undefined };
            }

            cachedPreviewPayloads.value = {
                ...cachedPreviewPayloads.value,
                [periodKey]: payload,
            };

            const response = await getInvoicePreview(payload);
            return { periodKey, response };
        });

        try {
            const updatedPreviews: Record<string, Invoice> = {
                ...invoicePreviewByBillingPeriod.value,
            };

            const results = await Promise.all(previewPromises);

            const trialSchedule = subscription.pricing_plan_schedule_infos.find(
                ({ pricing_plan_schedule }) => pricing_plan_schedule.type === 'TRIAL',
            );

            const invoiceScheduleId = subscription.pricing_plan_schedule_infos.find(
                ({ pricing_plan_schedule }) => pricing_plan_schedule.type === 'DEFAULT',
            )?.id;

            results.forEach(({ periodKey, response }) => {
                if (!response) return;

                lastPreviewScheduleId.value =
                    response.invoice_infos.at(-1)?.pricing_plan_schedule_id;

                if (trialSchedule) {
                    trialInvoicePreview.value = response.first_invoice;

                    if (trialSchedule.start_at && trialSchedule.end_at) {
                        trialPeriod.value = convertDateRangeToTimePeriod(
                            new Date(trialSchedule.start_at),
                            new Date(trialSchedule.end_at),
                        );
                    }
                }

                const invoiceInfo = response.invoice_infos.find(
                    ({ pricing_plan_schedule_id }) =>
                        pricing_plan_schedule_id === invoiceScheduleId,
                );

                const invoice = invoiceInfo?.invoices[0];
                if (invoice) {
                    updatedPreviews[periodKey] = invoice;
                }
            });

            invoicePreviewByBillingPeriod.value = updatedPreviews;
            invoicePreview.value = updatedPreviews[selectedPeriodKey];
        } catch (error) {
            status.value = ApiStatus.Failed;
            logger.error('INVOICE_PREVIEW_FAILED', 'Failed to load invoice preview', {}, error);
            throw error;
        } finally {
            status.value = ApiStatus.Done;
        }
    };

    return {
        loadInvoicePreview,
        invoicePreview,
        invoicePreviewByBillingPeriod,
        trialInvoicePreview,
        trialPeriod,
        lastPreviewScheduleId,
        isPending: computed(() => status.value === ApiStatus.Loading),
    };
};
