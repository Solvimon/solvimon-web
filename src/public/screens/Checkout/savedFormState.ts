import type { ConfiguredMeterValue, CountryCode } from '@solvimon/solvimon-types';
import { isValidCountryCode } from '@solvimon/solvimon-ui';
import { email } from '@vuelidate/validators';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';

const TEXT_FIELDS = [
    'companyLegalName',
    'firstName',
    'infix',
    'lastName',
    'addressLine1',
    'addressLine2',
    'postalCode',
    'city',
    'state',
    'companyVatNumber',
    'promotionCode',
] as const satisfies (keyof CheckoutFormState)[];

/** The API takes a count as a string, and the seats editor reads it back with `+number`. */
const COUNT_PATTERN = /^\d{1,9}$/;

const isCountryCode = (country: string): country is CountryCode => isValidCountryCode(country);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

function toMeterValues(value: unknown): ConfiguredMeterValue[] | undefined {
    if (!Array.isArray(value)) return undefined;

    const meterValues = value.flatMap((entry): ConfiguredMeterValue[] =>
        isRecord(entry) &&
        typeof entry.pricing_item_config_id === 'string' &&
        typeof entry.number === 'string' &&
        COUNT_PATTERN.test(entry.number)
            ? [{ pricing_item_config_id: entry.pricing_item_config_id, number: entry.number }]
            : [],
    );

    return meterValues.length === value.length ? meterValues : undefined;
}

/**
 * The fields of a form read back from storage that have the shape the form gives them; anything
 * else is dropped. Storage is shared with every script on the page, so it is not taken on trust.
 */
export function toRestorableForm(saved: unknown): Partial<CheckoutFormState> {
    if (!isRecord(saved)) return {};

    const form: Partial<CheckoutFormState> = {};

    TEXT_FIELDS.forEach((field) => {
        const value = saved[field];
        if (typeof value === 'string') form[field] = value;
    });

    if (typeof saved.email === 'string' && email.$validator(saved.email, {}, {})) {
        form.email = saved.email;
    }

    if (typeof saved.country === 'string' && isCountryCode(saved.country)) {
        form.country = saved.country;
    }

    if (saved.type === 'INDIVIDUAL' || saved.type === 'ORGANIZATION') {
        form.type = saved.type;
    }

    const seatsValues = toMeterValues(saved.seatsValues);
    if (seatsValues) form.seatsValues = seatsValues;

    const unitsValues = toMeterValues(saved.unitsValues);
    if (unitsValues) form.unitsValues = unitsValues;

    if (
        Array.isArray(saved.enabledPricingIds) &&
        saved.enabledPricingIds.every((id): id is string => typeof id === 'string')
    ) {
        form.enabledPricingIds = saved.enabledPricingIds;
    }

    return form;
}
