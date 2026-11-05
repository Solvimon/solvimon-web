import type { ConfiguredMeterValue, CountryCode } from '@solvimon/solvimon-types';
import { isValidCountryCode } from '@solvimon/solvimon-ui';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import { DEFAULT_TAX_IDENTIFIER_TYPE } from '@/components/customer/CheckoutForm/CheckoutForm.lib';
import type {
    CheckoutSessionAddressPatch,
    CheckoutSessionCustomerPatch,
    CheckoutSessionEffectiveDisplay,
    CheckoutSessionMeterBound,
    CheckoutSessionNewCustomer,
    CheckoutSessionScheduleCustomization,
    CheckoutSessionSubscription,
} from '@/types/checkoutSession';

const ADDRESS_PARTS = ['line1', 'line2', 'city', 'state', 'postal_code', 'country'] as const;

const isCountryCode = (country: string): country is CountryCode => isValidCountryCode(country);

/** What the form starts from: only what the session holds, so a value already in the form stays. */
export function toFormState(
    customer: CheckoutSessionNewCustomer | undefined,
): Partial<CheckoutFormState> {
    if (!customer) return {};

    const address =
        customer.type === 'ORGANIZATION'
            ? customer.organization?.registered_address
            : customer.individual?.residential_address;
    const name = customer.individual?.name;
    const vatNumber = customer.organization?.tax_ids?.[0]?.id;
    const country = address?.country;

    return {
        type: customer.type,
        ...(customer.email && { email: customer.email }),
        ...(customer.organization?.legal_name && {
            companyLegalName: customer.organization.legal_name,
        }),
        ...(name?.first_name && { firstName: name.first_name }),
        ...(name?.infix && { infix: name.infix }),
        ...(name?.last_name && { lastName: name.last_name }),
        ...(vatNumber && { companyVatNumber: vatNumber }),
        ...(address?.line1 && { addressLine1: address.line1 }),
        ...(address?.line2 && { addressLine2: address.line2 }),
        ...(address?.postal_code && { postalCode: address.postal_code }),
        ...(address?.city && { city: address.city }),
        ...(address?.state && { state: address.state }),
        ...(country && isCountryCode(country) && { country }),
    };
}

export type TextField = {
    [K in keyof CheckoutFormState]-?: CheckoutFormState[K] extends string | undefined ? K : never;
}[keyof CheckoutFormState];

const ADDRESS_FIELDS = {
    line1: 'addressLine1',
    line2: 'addressLine2',
    city: 'city',
    postal_code: 'postalCode',
    state: 'state',
    country: 'country',
} as const satisfies Record<(typeof ADDRESS_PARTS)[number], TextField>;

const NAME_PARTS = ['first_name', 'infix', 'last_name'] as const;

const NAME_FIELDS = {
    first_name: 'firstName',
    infix: 'infix',
    last_name: 'lastName',
} as const satisfies Record<(typeof NAME_PARTS)[number], TextField>;

/** The form fields each customer path of `missing_fields` stands for. */
const MISSING_FIELD_PATHS: Record<string, TextField[]> = {
    email: ['email'],
    'organization.legal_name': ['companyLegalName'],
    'organization.tax_id': ['companyVatNumber'],
    'organization.tax_ids': ['companyVatNumber'],
    'individual.name': ['firstName', 'lastName'],
    ...Object.fromEntries(
        NAME_PARTS.map((part) => [`individual.name.${part}`, [NAME_FIELDS[part]]]),
    ),
    ...Object.fromEntries(
        ['organization.registered_address', 'individual.residential_address'].flatMap((path) =>
            ADDRESS_PARTS.map((part) => [`${path}.${part}`, [ADDRESS_FIELDS[part]]]),
        ),
    ),
};

/** Per customer, in session order, the form fields `missing_fields` lists; other paths are left out. */
export function getMissingFormFields(paths: string[], customerCount: number): TextField[][] {
    const fields: TextField[][] = Array.from({ length: customerCount }, () => []);
    for (const path of paths) {
        const match = /^checkout_session\.customers\.(\d+)\.customer\.(.+)$/.exec(path);
        const known = match && MISSING_FIELD_PATHS[match[2]];
        if (known) fields[Number(match[1])]?.push(...known);
    }
    return fields;
}

/** Blank and untrimmed values read the same as the API keeps them. */
const clean = (value: string | undefined): string | undefined => value?.trim() || undefined;

/**
 * The keys the customer changed in the form from what the session holds, within the groups the
 * session lets them edit and whose fields are valid, and only in the block of the stored type.
 * Compared in the form's own terms, so a session the form was just filled from sends nothing.
 *
 * shortcut: a part the customer empties is not sent, as the API takes no `null` there; clearing a
 * name or address part needs an API that accepts it.
 */
export function getCustomerEdit(
    form: CheckoutFormState,
    customer: CheckoutSessionNewCustomer,
    display: CheckoutSessionEffectiveDisplay,
    isInvalid: (field: TextField) => boolean = () => false,
): { patch: CheckoutSessionCustomerPatch; fields: TextField[] } | undefined {
    const stored = toFormState(customer);
    /** The form fields the patch carries. */
    const fields: TextField[] = [];
    const isEditable = (group: keyof CheckoutSessionEffectiveDisplay, fields: TextField[]) =>
        display[group] === 'EDITABLE' && !fields.some(isInvalid);
    const changedTo = (field: TextField) => {
        const value = clean(form[field]);
        if (!value || value === clean(stored[field])) return undefined;
        fields.push(field);
        return value;
    };
    const changedAddress = () => {
        const parts: CheckoutSessionAddressPatch = {};
        for (const part of ADDRESS_PARTS) {
            const value = changedTo(ADDRESS_FIELDS[part]);
            if (value) parts[part] = value;
        }
        return Object.keys(parts).length ? parts : undefined;
    };
    const changedName = () => {
        const parts: NonNullable<CheckoutSessionCustomerPatch['individual']>['name'] = {};
        for (const part of NAME_PARTS) {
            const value = changedTo(NAME_FIELDS[part]);
            if (value) parts[part] = value;
        }
        return Object.keys(parts).length ? parts : undefined;
    };

    const edit: CheckoutSessionCustomerPatch = {};
    const email = isEditable('email', ['email']) ? changedTo('email') : undefined;
    if (email) edit.email = email;

    const address = isEditable('address', Object.values(ADDRESS_FIELDS))
        ? changedAddress()
        : undefined;

    if (customer.type === 'INDIVIDUAL') {
        const name = isEditable('customer_details', Object.values(NAME_FIELDS))
            ? changedName()
            : undefined;
        if (name || address) {
            edit.individual = {
                ...(name && { name }),
                ...(address && { residential_address: address }),
            };
        }
    } else {
        const legalName = isEditable('customer_details', ['companyLegalName'])
            ? changedTo('companyLegalName')
            : undefined;
        const taxIds = isEditable('tax_ids', ['companyVatNumber'])
            ? getTaxIdsEdit(form.companyVatNumber, customer)
            : undefined;
        if (taxIds !== undefined) fields.push('companyVatNumber');
        if (legalName || address || taxIds !== undefined) {
            edit.organization = {
                ...(legalName && { legal_name: legalName }),
                ...(address && { registered_address: address }),
                ...(taxIds !== undefined && { tax_ids: taxIds }),
            };
        }
    }
    return Object.keys(edit).length ? { patch: edit, fields } : undefined;
}

/**
 * The form shows only the first tax id, so a change there replaces that one, keeping its type, and
 * leaves the others; emptied with no others left, `null` clears the list. `undefined`: unchanged.
 */
function getTaxIdsEdit(
    vatNumber: string | undefined,
    customer: CheckoutSessionNewCustomer,
): NonNullable<CheckoutSessionCustomerPatch['organization']>['tax_ids'] | undefined {
    const storedIds = customer.organization?.tax_ids ?? [];
    const value = clean(vatNumber);
    if (value === clean(storedIds[0]?.id)) return undefined;

    const [first, ...others] = storedIds.map(({ id, type }) => ({ id, type }));
    const ids = value
        ? [{ id: value, type: first?.type ?? DEFAULT_TAX_IDENTIFIER_TYPE }, ...others]
        : others;
    return ids.length ? ids : null;
}

// shortcut: one schedule per subscription; a template with several schedules needs a schedule per config.
export function getScheduleId(
    subscription: CheckoutSessionSubscription,
    fallback: string | undefined,
): string | undefined {
    return (
        subscription.pricing_plan_schedule_customizations?.[0]?.pricing_plan_schedule_id ??
        subscription.starting_values?.[0]?.pricing_plan_schedule_id ??
        fallback
    );
}

type MeterKey = 'seats_values' | 'units';

/** The number a config stands at: the session's customization, else where it started. */
export function getCurrentMeterValues(
    subscription: CheckoutSessionSubscription,
    scheduleId: string,
    key: MeterKey,
): ConfiguredMeterValue[] {
    const customization = subscription.pricing_plan_schedule_customizations?.find(
        (entry) => entry.pricing_plan_schedule_id === scheduleId,
    );
    const starting = subscription.starting_values?.find(
        (entry) => entry.pricing_plan_schedule_id === scheduleId,
    );
    const values = new Map(
        [...(starting?.[key] ?? []), ...(customization?.[key] ?? [])].map(
            ({ pricing_item_config_id, number }) => [pricing_item_config_id, number],
        ),
    );
    return [...values].map(([pricing_item_config_id, number]) => ({
        pricing_item_config_id,
        number,
    }));
}

/**
 * Every config at its current number, and one the customer may edit but that has none yet at its
 * minimum; with the range of each editable config.
 */
export function getMeterValues(
    bounds: CheckoutSessionMeterBound[] | undefined,
    current: ConfiguredMeterValue[],
): {
    values: ConfiguredMeterValue[];
    minimums: ConfiguredMeterValue[];
    maximums: ConfiguredMeterValue[];
} {
    const unset = (bounds ?? []).filter(
        ({ pricing_item_config_id }) =>
            !current.some((value) => value.pricing_item_config_id === pricing_item_config_id),
    );
    const toValues = (key: 'min' | 'max') =>
        (bounds ?? []).map((bound) => ({
            pricing_item_config_id: bound.pricing_item_config_id,
            number: bound[key].number,
        }));
    return {
        values: [
            ...current,
            ...unset.map(({ pricing_item_config_id, min }) => ({
                pricing_item_config_id,
                number: min.number,
            })),
        ],
        minimums: toValues('min'),
        maximums: toValues('max'),
    };
}

/** Within the range the session gives, and a whole number for seats. */
const isWithinBounds = (
    number: string | undefined,
    bound: CheckoutSessionMeterBound,
    wholeOnly: boolean,
) => {
    const value = Number(number);
    return (
        Number.isFinite(value) &&
        (!wholeOnly || Number.isInteger(value)) &&
        value >= Number(bound.min.number) &&
        value <= Number(bound.max.number)
    );
};

/**
 * The values the form moved away from the session, for configs the session lists as editable and
 * within their range: the API refuses any other, and one refused value would hold back the rest.
 */
export function getMeterEdit(
    formValues: ConfiguredMeterValue[] | undefined,
    bounds: CheckoutSessionMeterBound[] | undefined,
    current: ConfiguredMeterValue[],
    { wholeOnly }: { wholeOnly: boolean },
): ConfiguredMeterValue[] | undefined {
    const changed = (formValues ?? []).filter(({ pricing_item_config_id, number }) => {
        const bound = bounds?.find(
            (entry) => entry.pricing_item_config_id === pricing_item_config_id,
        );
        const stored = current.find(
            (value) => value.pricing_item_config_id === pricing_item_config_id,
        );
        return (
            !!bound &&
            isWithinBounds(number, bound, wholeOnly) &&
            Number(number) !== Number(stored?.number)
        );
    });
    return changed.length ? changed : undefined;
}

export function getPromotionCodes(
    subscription: CheckoutSessionSubscription,
    scheduleId: string | undefined,
): CheckoutSessionScheduleCustomization['promotion_codes'] {
    return subscription.pricing_plan_schedule_customizations?.find(
        (entry) => entry.pricing_plan_schedule_id === scheduleId,
    )?.promotion_codes;
}
