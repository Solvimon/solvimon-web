import type { Customer, FormFieldError } from '@solvimon/solvimon-types';
type BillingInformationFormField =
    | 'email'
    | 'country'
    | 'companyLegalName'
    | 'companyVatNumber'
    | 'firstName'
    | 'lastName'
    | 'addressLine1'
    | 'addressLine2'
    | 'postalCode'
    | 'city'
    | 'state';

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

/**
 * Whether the customer has a billing address on file: a first line, which is what the billing
 * information block shows one by. A country alone, which the checkout may store, is not one.
 */
export const hasBillingAddress = (customer: Customer | undefined): boolean => {
    if (!customer) return false;

    const address =
        'individual' in customer
            ? customer.individual?.residential_address
            : 'organization' in customer
              ? customer.organization?.registered_address
              : undefined;

    return !!address?.line1?.trim();
};
