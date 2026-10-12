import type { FormFieldError } from '@solvimon/solvimon-types';
import type { BillingInformationFormState } from './BillingInformationForm.types';

type BillingInformationFormField = Exclude<keyof BillingInformationFormState, 'type'>;

export type BillingInformationFormApiErrors = {
    fields: Partial<Record<BillingInformationFormField, string>>;
    generic?: string;
};

// The API names a field by its path in the request, such as `organization.tax_ids[0].id` or
// `individual.residential_address.line1`; the older form keys are kept for hosts that pass them.
const FIELD_BY_PATH_SEGMENT: Record<string, BillingInformationFormField> = {
    email: 'email',
    country: 'country',
    legal_name: 'companyLegalName',
    tax_ids: 'companyVatNumber',
    tax_id: 'companyVatNumber',
    vat_number: 'companyVatNumber',
    first_name: 'firstName',
    last_name: 'lastName',
    line1: 'addressLine1',
    address_line_1: 'addressLine1',
    line2: 'addressLine2',
    address_line_2: 'addressLine2',
    postal_code: 'postalCode',
    city: 'city',
    state: 'state',
};

const getFormField = (path: string): BillingInformationFormField | undefined =>
    path
        .split('.')
        .map((segment) => segment.replace(/\[\d+\]$/, ''))
        .reverse()
        .map((segment) => FIELD_BY_PATH_SEGMENT[segment])
        .find((field) => field !== undefined);

/**
 * Sorts an API error onto the fields of the form. An error about a field the form does not show
 * is reported as a generic one, so it is never swallowed.
 */
export const getBillingInformationFormApiErrors = (
    apiError: FormFieldError,
    visibleFields: readonly BillingInformationFormField[],
): BillingInformationFormApiErrors => {
    const result: BillingInformationFormApiErrors = { fields: {} };

    Object.entries(apiError ?? {}).forEach(([path, message]) => {
        const field = path === '_generic' ? undefined : getFormField(path);

        if (field && visibleFields.includes(field)) {
            result.fields[field] = message;
        } else {
            result.generic ??= message;
        }
    });

    return result;
};
