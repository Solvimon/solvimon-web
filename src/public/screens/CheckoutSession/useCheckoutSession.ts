import type {
    Amount,
    ConfiguredMeterValue,
    Invoice,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import { useIntl } from '@solvimon/solvimon-ui';
import { computed, effectScope, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import {
    type TextField,
    getCurrentMeterValues,
    getCustomerEdit,
    getEditableMeterValues,
    getMeterEdit,
    getMissingFormFields,
    getPromotionCodes,
    getScheduleId,
    toFormState,
} from './checkoutSessionForm';
import type {
    CheckoutCustomerForm,
    CheckoutSource,
    PriceSettlement,
} from '@/public/screens/Checkout/Checkout.source.types';
import { useLogger } from '@/components/providers';
import { useCheckoutForm } from '@/components/customer/CheckoutForm/useCheckoutForm';
import { getInitialState } from '@/components/customer/CheckoutForm/CheckoutForm.lib';
import { useWatchDebounced } from '@/composables/useWatchDebounced';
import { isApiError } from '@/services/apiError';
import {
    type CheckoutSessionEdit,
    createCheckoutSessionsService,
    isEmptyCheckoutSessionPatch,
    toCheckoutSessionPatch,
} from '@/services/checkoutSessions';
import { createSubscriptionsService } from '@/services/subscriptions';
import { getFirstPricingPlanScheduleOfType } from '@/utils/pricingPlanSchedule';
import { splitInvoiceByRecurrence } from '@/utils/invoice';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import type {
    CheckoutSessionCustomerPatch,
    CheckoutSessionCustomizationPatch,
    CheckoutSessionEffectiveDisplay,
    CheckoutSessionNewCustomer,
    CheckoutSessionPortalUrlResponse,
    CheckoutSessionPreview,
} from '@/types/checkoutSession';

export const CHECKOUT_SESSION_EDIT_DEBOUNCE_MS = 400;
/** A preview of an older version is asked again, a few times at most. */
const MAX_PREVIEW_ATTEMPTS = 3;
const SESSION_ID_PLACEHOLDER = '{CHECKOUT_SESSION_ID}';

const REFILLED_FIELDS: TextField[] = [
    'email',
    'companyLegalName',
    'firstName',
    'infix',
    'lastName',
    'companyVatNumber',
    'addressLine1',
    'addressLine2',
    'postalCode',
    'city',
    'state',
    'country',
];

const copyField = <K extends TextField>(
    target: CheckoutFormState,
    source: CheckoutFormState,
    field: K,
) => {
    target[field] = source[field];
};

const pickBy = <T extends object>(
    source: T,
    keep: (key: string, value: unknown) => boolean,
): Partial<T> => {
    const picked: Partial<T> = {};
    for (const key in source) {
        if (keep(key, source[key])) picked[key] = source[key];
    }
    return picked;
};

type CheckoutForm = ReturnType<typeof useCheckoutForm>;

/** A customer that already exists cannot be edited, so its form asks for nothing. */
const NOTHING_SHOWN: CheckoutSessionEffectiveDisplay = {
    customer_details: 'HIDDEN',
    address: 'HIDDEN',
    tax_ids: 'HIDDEN',
    email: 'HIDDEN',
    custom_fields: 'HIDDEN',
};

const fieldValidation = (form: CheckoutForm, field: TextField) => {
    const result: unknown = Reflect.get(form.validation.value, field);
    return typeof result === 'object' && result !== null ? result : undefined;
};

const titleOf = (customer: CheckoutSessionNewCustomer) => {
    const name = customer.individual?.name;
    return (
        (customer.type === 'ORGANIZATION'
            ? customer.organization?.legal_name
            : [name?.first_name, name?.infix, name?.last_name].filter(Boolean).join(' ')) ||
        customer.reference
    );
};

const isBadRequestOn = (error: unknown, field: string) =>
    isApiError(error) && error.statusCode === 400 && !!error.field?.endsWith(field);

export function useCheckoutSession({ portalUrlId }: { portalUrlId: string }) {
    const logger = useLogger();
    const { $t } = useIntl();
    const service = createCheckoutSessionsService();
    const { getSubscription } = createSubscriptionsService();

    const portalUrl = shallowRef<CheckoutSessionPortalUrlResponse>();
    const preview = shallowRef<CheckoutSessionPreview>();
    /** The plan of each subscription, in the session's order. */
    const templates = shallowRef<(PricingPlanSubscriptionExpanded | undefined)[]>([]);
    const isSaving = ref(false);
    const isPaid = ref(false);

    const session = computed(() => portalUrl.value?.checkout_session);
    const isOpen = computed(
        () => portalUrl.value?.status === 'PUBLISHED' && session.value?.status === 'OPEN',
    );

    const isPreviewBehind = computed(
        () =>
            !!session.value &&
            (preview.value?.checkout_session.version ?? -1) < session.value.version,
    );

    const missingFields = computed(() => [
        ...new Set([
            ...(session.value?.missing_fields ?? []),
            ...(isPreviewBehind.value
                ? []
                : (preview.value?.checkout_session.missing_fields ?? [])),
        ]),
    ]);
    const missingFormFields = computed(() =>
        getMissingFormFields(missingFields.value, session.value?.customers.length ?? 0),
    );

    const displayOf = (index: number) => {
        const customer = session.value?.customers[index];
        if (!customer) return undefined;
        return customer.customer ? customer.effective_display : NOTHING_SHOWN;
    };

    const createForm = (index: number) =>
        useCheckoutForm({
            initialState: {},
            // Every change is saved to the session, not only those that move the price.
            onRequiredFieldChange: () => {},
            display: () => displayOf(index),
            alsoRequired: () => missingFormFields.value[index] ?? [],
            // A guess would be saved into the merchant's session as the customer's country.
            guessCountry: false,
        });

    /** One form per customer, in session order; the first also holds the quantities. */
    const checkoutForm = createForm(0);
    const forms = shallowRef<CheckoutForm[]>([checkoutForm]);
    // Made once the session says how many customers there are, and stopped with the screen.
    const formsScope = effectScope();
    const createFormsFor = (count: number) => {
        const added = formsScope.run(() =>
            Array.from({ length: count - forms.value.length }, (_, offset) =>
                createForm(forms.value.length + offset),
            ),
        );
        if (added?.length) forms.value = [...forms.value, ...added];
    };

    // shortcut: the editor edits the first subscription; an editor per subscription comes with
    // the screen that lists them all.
    const scheduleIdOf = (index: number) => {
        const subscription = session.value?.pricing_plan_subscriptions[index];
        const template = templates.value[index];
        if (!subscription) return undefined;
        return getScheduleId(
            subscription,
            template &&
                getFirstPricingPlanScheduleOfType({
                    pricingPlanScheduleInfos: template.pricing_plan_schedule_infos,
                    type: 'DEFAULT',
                })?.id,
        );
    };

    /** The one subscription a promotion code goes on: the first that takes one. */
    const promotionCodeIndex = computed(
        () =>
            session.value?.pricing_plan_subscriptions.findIndex(
                (subscription) => subscription.options?.allow_promotion_codes === 'SINGLE',
            ) ?? -1,
    );
    /** `undefined` follows the session; a string applies that code, `null` removes it. */
    const wantedPromotionCode = ref<string | null>();

    const getCustomerChange = (index: number) => {
        const customer = session.value?.customers[index];
        const form = forms.value[index];
        // A customer that already exists cannot be edited from the checkout.
        return customer?.customer && form
            ? getCustomerEdit(
                  form.form.value,
                  customer.customer,
                  customer.effective_display,
                  (field) => Reflect.get(fieldValidation(form, field) ?? {}, '$invalid') === true,
              )
            : undefined;
    };

    /** Parts the API refused, by path, with the value refused: left out until that value changes. */
    const refusedParts = reactive(new Map<string, string>());
    const isRefused = (path: string, value: unknown) =>
        refusedParts.get(path) === JSON.stringify(value);

    const withoutRefusedCustomerParts = (
        patch: CheckoutSessionCustomerPatch | undefined,
        index: number,
    ): CheckoutSessionCustomerPatch | undefined => {
        if (!patch) return undefined;
        const at = `customers.${index}`;
        const { individual, organization, ...rest } = patch;
        const keep = <T extends object>(group: T | undefined, prefix: string) => {
            if (!group) return undefined;
            const kept = pickBy(group, (key, value) => !isRefused(`${prefix}.${key}`, value));
            return Object.keys(kept).length ? kept : undefined;
        };
        const kept: CheckoutSessionCustomerPatch = {
            ...keep(rest, at),
            ...(keep(individual, `${at}.individual`) && {
                individual: keep(individual, `${at}.individual`),
            }),
            ...(keep(organization, `${at}.organization`) && {
                organization: keep(organization, `${at}.organization`),
            }),
        };
        return Object.keys(kept).length ? kept : undefined;
    };

    /** Every part of an edit by path; a promotion code is left to its own error handling. */
    const partsOf = (edit: CheckoutSessionEdit): [string, unknown][] => [
        ...(edit.customers ?? []).flatMap((customer, index) =>
            Object.entries(customer ?? {}).flatMap(([key, value]): [string, unknown][] =>
                key === 'individual' || key === 'organization'
                    ? Object.entries(value ?? {}).map(([part, partValue]) => [
                          `customers.${index}.${key}.${part}`,
                          partValue,
                      ])
                    : [[`customers.${index}.${key}`, value]],
            ),
        ),
        ...(edit.pricing_plan_subscriptions ?? []).flatMap((customizations, index) =>
            (customizations ?? []).flatMap((customization): [string, unknown][] =>
                (['seats_values', 'units'] as const).flatMap((key) =>
                    (customization[key] ?? []).map(
                        ({ pricing_item_config_id, number }): [string, unknown] => [
                            `subs.${index}.${key}.${pricing_item_config_id}`,
                            number,
                        ],
                    ),
                ),
            ),
        ),
    ];

    /** The part of the edit a 400's `field` names, or everything sent when it names none. */
    const rememberRefused = (edit: CheckoutSessionEdit, field: string | undefined) => {
        const [root, index, ...rest] = (field ?? '').replace(/^checkout_session\./, '').split('.');
        const prefix =
            root === 'customers' && rest[0] === 'customer'
                ? ['customers', index, ...rest.slice(1, 3)].join('.')
                : root === 'pricing_plan_subscriptions'
                  ? ['subs', index, ...rest.slice(2, 3)].join('.')
                  : '';
        for (const [path, value] of partsOf(edit)) {
            if (path === prefix || path.startsWith(`${prefix}.`) || !prefix) {
                refusedParts.set(path, JSON.stringify(value));
            }
        }
    };

    const getEdit = (): CheckoutSessionEdit => {
        const current = session.value;
        if (!current) return {};

        const subscriptions = current.pricing_plan_subscriptions.map((subscription, index) => {
            const scheduleId = scheduleIdOf(index);
            if (!scheduleId) return undefined;

            const customization: CheckoutSessionCustomizationPatch = {
                pricing_plan_schedule_id: scheduleId,
            };
            if (index === 0) {
                const seats = getMeterEdit(
                    checkoutForm.form.value.seatsValues,
                    subscription.options?.edit_seats,
                    getCurrentMeterValues(subscription, scheduleId, 'seats_values'),
                    { wholeOnly: true },
                );
                const units = getMeterEdit(
                    checkoutForm.form.value.unitsValues,
                    subscription.options?.edit_units,
                    getCurrentMeterValues(subscription, scheduleId, 'units'),
                    { wholeOnly: false },
                );
                const allowed = (
                    key: 'seats_values' | 'units',
                    values: ConfiguredMeterValue[] | undefined,
                ) =>
                    values?.filter(
                        ({ pricing_item_config_id, number }) =>
                            !isRefused(`subs.${index}.${key}.${pricing_item_config_id}`, number),
                    );
                const sentSeats = allowed('seats_values', seats);
                const sentUnits = allowed('units', units);
                if (sentSeats?.length) customization.seats_values = sentSeats;
                if (sentUnits?.length) customization.units = sentUnits;
            }
            if (index === promotionCodeIndex.value && wantedPromotionCode.value !== undefined) {
                const codes = wantedPromotionCode.value ? [wantedPromotionCode.value] : null;
                const currentCodes = getPromotionCodes(subscription, scheduleId);
                if ((codes?.[0] ?? null) !== (currentCodes?.[0] ?? null)) {
                    customization.promotion_codes = codes;
                }
            }
            return Object.keys(customization).length > 1 ? [customization] : undefined;
        });

        return {
            customers: forms.value.map((_, index) =>
                withoutRefusedCustomerParts(getCustomerChange(index)?.patch, index),
            ),
            pricing_plan_subscriptions: subscriptions,
        };
    };

    /** The edit alone, without the version, so a new version does not count as a new edit. */
    const keyOf = (edit: CheckoutSessionEdit) => {
        const body = toCheckoutSessionPatch(0, edit);
        return isEmptyCheckoutSessionPatch(body) ? '' : JSON.stringify(body);
    };
    const pendingKey = computed(() => (session.value && isOpen.value ? keyOf(getEdit()) : ''));
    /** An edit the API refused, or one a save left as it was: not sent again until it changes. */
    const settledKey = ref<string>();
    const hasUnsavedEdit = computed(
        () => !!pendingKey.value && pendingKey.value !== settledKey.value,
    );

    const previewRuns = ref(0);
    const isPreviewPending = computed(() => previewRuns.value > 0);

    /** Gives up after a few previews of an older version; the next save or settle asks again. */
    const refreshPreview = async () => {
        previewRuns.value++;
        try {
            for (let attempt = 0; attempt < MAX_PREVIEW_ATTEMPTS; attempt++) {
                const result = await service.previewCheckoutSession(portalUrlId);
                if (
                    !preview.value ||
                    result.checkout_session.version >= preview.value.checkout_session.version
                ) {
                    preview.value = result;
                }
                if (result.checkout_session.version >= (session.value?.version ?? 0)) return;
            }
        } catch (error) {
            logger.error(
                'INVOICE_PREVIEW_FAILED',
                'Failed to preview the checkout session',
                {},
                error,
            );
        } finally {
            previewRuns.value--;
        }
    };

    /**
     * After a save, a field the customer has not typed in since takes the session's value: what the
     * API made of a value sent, and what changed elsewhere in one left alone. A field held back as
     * invalid keeps what the customer typed.
     */
    const refillForm = (
        index: number,
        before: CheckoutSessionNewCustomer | undefined,
        sentForm: CheckoutFormState,
        sentFields: TextField[],
    ) => {
        const stored = getInitialState(toFormState(before));
        const fresh = getInitialState(toFormState(session.value?.customers[index]?.customer));
        const form = forms.value[index].form.value;
        for (const field of REFILLED_FIELDS) {
            const isUntypedSince = form[field] === sentForm[field];
            const isSentOrUntouched =
                sentFields.includes(field) || sentForm[field] === stored[field];
            if (isUntypedSince && isSentOrUntouched && form[field] !== fresh[field]) {
                copyField(form, fresh, field);
            }
        }
    };

    /** Sends what the form changed, against the version last read. Never while the session is closed. */
    const save = async () => {
        if (!session.value || !isOpen.value) return;

        const edit = getEdit();
        const key = keyOf(edit);
        if (!key || key === settledKey.value) return;

        const sent = forms.value.map((form, index) => ({
            before: session.value?.customers[index]?.customer,
            form: { ...form.form.value },
            fields: getCustomerChange(index)?.fields ?? [],
        }));

        isSaving.value = true;
        try {
            try {
                portalUrl.value = await service.updateCheckoutSession(
                    portalUrlId,
                    toCheckoutSessionPatch(session.value.version, edit),
                );
            } catch (error) {
                if (!isBadRequestOn(error, 'expected_version')) {
                    if (isApiError(error) && error.statusCode === 400) {
                        rememberRefused(edit, error.field);
                    }
                    throw error;
                }

                // Changed elsewhere since it was read: the same edit goes again on the new version.
                portalUrl.value = await service.getCheckoutSession(portalUrlId);
                if (!isOpen.value) return;
                portalUrl.value = await service.updateCheckoutSession(
                    portalUrlId,
                    toCheckoutSessionPatch(portalUrl.value.checkout_session.version, edit),
                );
            }
            sent.forEach(({ before, form, fields }, index) =>
                refillForm(index, before, form, fields),
            );

            if (keyOf(getEdit()) === key) {
                settledKey.value = key;
                logger.warn(
                    'CHECKOUT_SESSION_EDIT_NOT_APPLIED',
                    'The checkout session was saved but kept a value the customer changed',
                );
            }
        } finally {
            isSaving.value = false;
        }
        await refreshPreview();
    };

    // One save at a time, so each one sends the version the last one returned.
    let queue: Promise<void> = Promise.resolve();
    const enqueueSave = (): Promise<void> => {
        const run = queue.then(save);
        queue = run.catch(() => {});
        return run;
    };

    const isRefusal = (error: unknown) => isApiError(error) && error.statusCode === 400;

    const saveQuietly = () =>
        enqueueSave().catch((error) => {
            if (isRefusal(error)) {
                logger.warn(
                    'CHECKOUT_SESSION_UPDATE_REFUSED',
                    'The API refused a change to the checkout session',
                    { field: isApiError(error) ? error.field : undefined },
                    error,
                );
                return;
            }
            logger.error(
                'CHECKOUT_SESSION_UPDATE_FAILED',
                'Failed to save the checkout session',
                {},
                error,
            );
        });

    useWatchDebounced(() => pendingKey.value, saveQuietly, {
        debounce: CHECKOUT_SESSION_EDIT_DEBOUNCE_MS,
    });

    const promotionCode = ref<string | null>(null);
    const isPromotionCodePending = ref(false);
    const promotionCodeErrorMessage = ref<string | null>(null);

    const appliedPromotionCode = computed(() => {
        const index = promotionCodeIndex.value;
        const subscription = session.value?.pricing_plan_subscriptions[index];
        return subscription
            ? (getPromotionCodes(subscription, scheduleIdOf(index))?.[0] ?? null)
            : null;
    });

    watch(appliedPromotionCode, (code) => {
        if (!isPromotionCodePending.value) promotionCode.value = code;
    });

    const changePromotionCode = async (code: string | null, action: 'apply' | 'remove') => {
        wantedPromotionCode.value = code;
        promotionCodeErrorMessage.value = null;
        isPromotionCodePending.value = true;
        try {
            await enqueueSave();
        } catch (error) {
            const isRejected = action === 'apply' && isBadRequestOn(error, 'promotion_codes');
            if (isRejected) {
                logger.warn(
                    'PROMOTION_CODE_REJECTED',
                    'The promotion code was not accepted',
                    {},
                    error,
                );
            } else if (isRefusal(error)) {
                logger.warn(
                    'CHECKOUT_SESSION_UPDATE_REFUSED',
                    'The API refused a change to the checkout session',
                    { field: isApiError(error) ? error.field : undefined },
                    error,
                );
            } else {
                logger.capture(error, {
                    code:
                        action === 'apply'
                            ? 'PROMOTION_CODE_APPLY_FAILED'
                            : 'PROMOTION_CODE_REMOVE_FAILED',
                    message: 'Failed to change the promotion code of the checkout session',
                });
            }
            promotionCodeErrorMessage.value = isRejected
                ? $t({
                      defaultMessage: 'This promotion code is not valid.',
                      id: 'checkout_session.promotion_code.rejected',
                      description:
                          'Error shown under the promotion code field when the code the customer entered was not accepted',
                  })
                : action === 'apply'
                  ? $t({
                        defaultMessage: 'Promotion code could not be applied. Please try again.',
                        id: 'checkout.promotion_code.apply_failed',
                        description:
                            'Error message when applying a promotion code in checkout failed',
                    })
                  : $t({
                        defaultMessage: 'Promotion code could not be removed. Please try again.',
                        id: 'checkout.promotion_code.remove_failed',
                        description:
                            'Error message when removing a promotion code in checkout failed',
                    });
            wantedPromotionCode.value = undefined;
            // The rest of the edit went down with the code, so it goes again without it.
            void saveQuietly();
        } finally {
            isPromotionCodePending.value = false;
            promotionCode.value = appliedPromotionCode.value;
        }
    };

    const loadTemplates = async (response: CheckoutSessionPortalUrlResponse) => {
        templates.value = await Promise.all(
            response.checkout_session.pricing_plan_subscriptions.map(
                ({ template_pricing_plan_subscription_id: id }) =>
                    getSubscription({ id, expanded: true }).catch((error: unknown) => {
                        logger.error(
                            'SUBSCRIPTION_LOAD_FAILED',
                            'Failed to load the plan of a checkout session subscription',
                            {},
                            error,
                        );
                        return undefined;
                    }),
            ),
        );
    };

    const orderMeterValues = shallowRef<CheckoutSource['orderMeterValues']['value']>({});

    /** Each form follows its customer; the first also the first subscription's quantities. */
    const fillForm = () => {
        const current = session.value;
        const subscription = current?.pricing_plan_subscriptions[0];
        const scheduleId = scheduleIdOf(0);
        const editable = (key: 'seats_values' | 'units', bounds: 'edit_seats' | 'edit_units') =>
            subscription && scheduleId
                ? getEditableMeterValues(
                      subscription.options?.[bounds],
                      getCurrentMeterValues(subscription, scheduleId, key),
                  )
                : undefined;
        const seats = editable('seats_values', 'edit_seats');
        const units = editable('units', 'edit_units');

        orderMeterValues.value = { seatsValues: seats?.minimums, unitsValues: units?.minimums };
        checkoutForm.updateInitialState({
            ...(seats && { seatsValues: seats.values }),
            ...(units && { unitsValues: units.values }),
        });
        forms.value.forEach((form, index) =>
            form.updateInitialState(toFormState(current?.customers[index]?.customer)),
        );
    };

    const isLoaded = ref(false);

    // A field the session misses shows as such, typed in or not, once the session is read.
    watch([isLoaded, missingFormFields], () => {
        if (!isLoaded.value) return;
        forms.value.forEach((form, index) => {
            for (const field of missingFormFields.value[index] ?? []) {
                const touch: unknown = Reflect.get(fieldValidation(form, field) ?? {}, '$touch');
                if (typeof touch === 'function') touch();
            }
        });
    });

    const load = async () => {
        const [response] = await Promise.all([
            service.getCheckoutSession(portalUrlId),
            refreshPreview(),
        ]);
        await loadTemplates(response);
        createFormsFor(response.checkout_session.customers.length);
        // Set together with the form, so the form is never compared with a session it has not seen.
        portalUrl.value = response;
        fillForm();
        isLoaded.value = true;
        promotionCode.value = appliedPromotionCode.value;

        if ((preview.value?.checkout_session.version ?? -1) < response.checkout_session.version) {
            await refreshPreview();
        }
    };

    onMounted(async () => {
        try {
            await load();
        } catch (error) {
            logger.error(
                'CHECKOUT_SESSION_LOAD_FAILED',
                'Failed to load the checkout session',
                {},
                error,
            );
        }
    });

    const invoicePreview = computed<Invoice | undefined>(
        () => preview.value?.invoices?.[0]?.invoice,
    );
    const amount = computed<Amount | undefined>(() => {
        const total = preview.value?.total;
        return total ? { quantity: total.amount_incl_tax, currency: total.currency } : undefined;
    });
    const invoiceRecurrence = computed(() =>
        invoicePreview.value ? splitInvoiceByRecurrence(invoicePreview.value) : undefined,
    );
    const recurringAmount = computed<Amount | undefined>(() => {
        const split = invoiceRecurrence.value;
        if (!split) return undefined;
        if (!split.hasOneOff) return invoicePreview.value?.invoice_amount_including_tax;
        return split.hasUnattributed ? undefined : split.recurring.includingTax;
    });

    const isInvoicePreviewStale = computed(() => hasUnsavedEdit.value || isPreviewBehind.value);

    const canPay = computed(
        () =>
            isOpen.value &&
            !!amount.value &&
            !isInvoicePreviewStale.value &&
            missingFields.value.length === 0,
    );

    const settleInvoicePreview = async (): Promise<PriceSettlement> => {
        try {
            await enqueueSave();
        } catch {
            return 'FAILED';
        }
        if (isPreviewBehind.value) await refreshPreview();
        return isInvoicePreviewStale.value ? 'CHANGED' : 'SETTLED';
    };

    const withSessionId = (url: string | undefined) =>
        url?.replaceAll(SESSION_ID_PLACEHOLDER, encodeURIComponent(portalUrlId));

    const source: CheckoutSource = {
        subscription: computed(() => templates.value[0]),
        orderMeterValues,
        checkoutForm,
        customerForms: computed(() => {
            const customers = session.value?.customers ?? [];
            return customers.flatMap((customer, index): CheckoutCustomerForm[] => {
                const form = forms.value[index];
                // An existing customer cannot be edited, and the session gives nothing to show of it.
                if (!customer.customer || !form) return [];
                return [
                    {
                        key: `${index}`,
                        form,
                        display: customer.effective_display,
                        isTypeLocked: true,
                        ...(customers.length > 1 && { title: titleOf(customer.customer) }),
                    },
                ];
            });
        }),
        isShippingAddressRequired: false,
        invoicePreview,
        invoicePreviewByBillingPeriod: computed(() => ({})),
        trialInvoicePreview: computed(() => undefined),
        trialPeriod: computed(() => undefined),
        isInvoicePreviewPending: computed(() => isPreviewPending.value || isSaving.value),
        isInvoicePreviewStale,
        settleInvoicePreview,
        amount,
        recurringAmount,
        hasOneOffCharges: computed(() => invoiceRecurrence.value?.hasOneOff ?? false),
        promotionCode: {
            isAllowed: computed(() => isOpen.value && promotionCodeIndex.value !== -1),
            code: promotionCode,
            isPending: isPromotionCodePending,
            errorMessage: promotionCodeErrorMessage,
            apply: (code) => {
                const trimmed = code?.trim();
                return trimmed ? changePromotionCode(trimmed, 'apply') : undefined;
            },
            remove: () => changePromotionCode(null, 'remove'),
        },
        canPay,
        isPaid,
        successUrl: computed(() => withSessionId(session.value?.success_url)),
        note: computed(() => session.value?.note),
    };

    return {
        source,
        /** What the screen that lists every customer and subscription reads. */
        portalUrl,
        session,
        preview,
        templates,
        isOpen,
        missingFields,
        cancelUrl: computed(() => withSessionId(session.value?.cancel_url)),
    };
}
