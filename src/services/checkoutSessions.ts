import { createRequestService } from './requests';
import { buildUrl } from './requests.lib';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import type {
    CheckoutSessionAddressPatch,
    CheckoutSessionCustomerPatch,
    CheckoutSessionCustomizationPatch,
    CheckoutSessionPatchBody,
    CheckoutSessionPortalUrlResponse,
    CheckoutSessionPreview,
} from '@/types/checkoutSession';

const CUSTOMER_KEYS = ['email', 'custom_fields', 'individual', 'organization'] as const;
const INDIVIDUAL_KEYS = ['name', 'residential_address'] as const;
const NAME_KEYS = ['first_name', 'last_name', 'infix'] as const;
const ADDRESS_KEYS = ['line1', 'line2', 'city', 'postal_code', 'state', 'country'] as const;
const ORGANIZATION_KEYS = [
    'legal_name',
    'tax_id',
    'tax_ids',
    'registration_number',
    'tax_exempt',
    'tax_exempt_note',
    'registered_address',
    'tax_registrations',
] as const;
const CUSTOMIZATION_KEYS = [
    'pricing_plan_schedule_id',
    'seats_values',
    'units',
    'promotion_codes',
] as const;

/** Only `keys`, and `null` only on the lists it clears: the API refuses anything else. */
function pickSet<T extends object, K extends keyof T>(
    source: T,
    keys: readonly K[],
    nullable: readonly K[] = [],
): Partial<Pick<T, K>> {
    const picked: Partial<Pick<T, K>> = {};
    for (const key of keys) {
        const value = source[key];
        if (value === undefined || (value === null && !nullable.includes(key))) continue;
        picked[key] = value;
    }
    return picked;
}

const pickAddress = (address: CheckoutSessionAddressPatch) => pickSet(address, ADDRESS_KEYS);

const toCustomerPatch = (customer: CheckoutSessionCustomerPatch): CheckoutSessionCustomerPatch => {
    const { individual, organization, ...rest } = pickSet(customer, CUSTOMER_KEYS, [
        'custom_fields',
    ]);
    const individualPatch = individual && pickSet(individual, INDIVIDUAL_KEYS);
    const organizationPatch =
        organization && pickSet(organization, ORGANIZATION_KEYS, ['tax_ids', 'tax_registrations']);

    return {
        ...rest,
        ...(individualPatch && {
            individual: {
                ...(individualPatch.name && { name: pickSet(individualPatch.name, NAME_KEYS) }),
                ...(individualPatch.residential_address && {
                    residential_address: pickAddress(individualPatch.residential_address),
                }),
            },
        }),
        ...(organizationPatch && {
            organization: {
                ...organizationPatch,
                ...(organizationPatch.registered_address && {
                    registered_address: pickAddress(organizationPatch.registered_address),
                }),
                // A stored id carries read-only keys, such as its validation result.
                ...(organizationPatch.tax_ids && {
                    tax_ids: organizationPatch.tax_ids.map(({ id, type }) => ({ id, type })),
                }),
            },
        }),
    };
};

const toCustomizationPatch = (
    customization: CheckoutSessionCustomizationPatch,
): CheckoutSessionCustomizationPatch => ({
    ...pickSet(customization, CUSTOMIZATION_KEYS, ['promotion_codes']),
    pricing_plan_schedule_id: customization.pricing_plan_schedule_id,
});

const untouched: Record<string, never> = {};

/** Untouched entries in the middle become `{}`; trailing ones are left off. */
const positional = <T, R extends object>(
    entries: (T | undefined)[] | undefined,
    toEntry: (entry: T) => R | Record<string, never>,
): (R | Record<string, never>)[] | undefined => {
    const list = (entries ?? []).map((entry) => (entry ? toEntry(entry) : untouched));
    while (list.length && Object.keys(list[list.length - 1]).length === 0) list.pop();
    return list.length ? list : undefined;
};

export interface CheckoutSessionEdit {
    customers?: (CheckoutSessionCustomerPatch | undefined)[];
    /** Per subscription, the customizations to send, each with its `pricing_plan_schedule_id`. */
    pricing_plan_subscriptions?: (CheckoutSessionCustomizationPatch[] | undefined)[];
}

export function toCheckoutSessionPatch(
    expectedVersion: number,
    edit: CheckoutSessionEdit,
): CheckoutSessionPatchBody {
    const customers = positional(edit.customers, (customer) => {
        const patch = toCustomerPatch(customer);
        return Object.keys(patch).length ? { customer: patch } : untouched;
    });
    const subscriptions = positional(edit.pricing_plan_subscriptions, (customizations) =>
        customizations.length
            ? { pricing_plan_schedule_customizations: customizations.map(toCustomizationPatch) }
            : untouched,
    );

    return {
        checkout_session: {
            expected_version: expectedVersion,
            ...(customers && { customers }),
            ...(subscriptions && { pricing_plan_subscriptions: subscriptions }),
        },
    };
}

export function isEmptyCheckoutSessionPatch(body: CheckoutSessionPatchBody): boolean {
    return !body.checkout_session.customers && !body.checkout_session.pricing_plan_subscriptions;
}

export function createCheckoutSessionsService() {
    const config = useConfig();
    const request = createRequestService();
    const portalUrl = (id: string, ...rest: string[]) =>
        buildUrl(config.apiUrls.transaction, 'portal', 'portal-urls', id, ...rest);

    return {
        getCheckoutSession(id: string): Promise<CheckoutSessionPortalUrlResponse> {
            return request<CheckoutSessionPortalUrlResponse>({ url: portalUrl(id) });
        },
        /** A stale `expected_version` or a refused promotion code is a 400 the caller handles. */
        updateCheckoutSession(
            id: string,
            body: CheckoutSessionPatchBody,
        ): Promise<CheckoutSessionPortalUrlResponse> {
            return request<CheckoutSessionPortalUrlResponse>({
                url: portalUrl(id),
                data: body,
                options: { method: 'PATCH', expectedStatusCodes: [400] },
            });
        },
        previewCheckoutSession(id: string): Promise<CheckoutSessionPreview> {
            return request<CheckoutSessionPreview>({
                url: portalUrl(id, 'preview'),
                options: { method: 'POST' },
            });
        },
    };
}
