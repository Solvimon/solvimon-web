import type { Address, Customer } from '@solvimon/solvimon-types';
import { taxId } from '@solvimon/solvimon-ui/validators';
import type { GetInvoicePreviewCustomer } from '@/services/invoices.types';

const EMPTY_LEGAL_ENTITY_NAME = 'preview';
const EMPTY_COUNTRY = 'NL';

/**
 * Local variant of `getCustomerAddress` from `@solvimon/solvimon-ui`, which needs a complete
 * `Customer` (as do its `isIndividual` / `isOrganization` guards) while a preview is calculated
 * for the details entered so far.
 */
export const getCustomerAddress = (customer: Partial<Customer>): Partial<Address> | undefined => {
    if ('organization' in customer) {
        return customer.organization?.registered_address;
    }

    if ('individual' in customer) {
        return customer.individual?.residential_address;
    }

    return undefined;
};

/**
 * The country drives both the tax calculation and the pricing currency, so it always has to be
 * sent — even when the customer has not filled in an address yet.
 */
export const buildAddress = (customer: Partial<Customer>): Address => {
    const address = getCustomerAddress(customer);

    return {
        ...(address?.line1 && { line1: address.line1 }),
        ...(address?.line2 && { line2: address.line2 }),
        ...(address?.city && { city: address.city }),
        ...(address?.state && { state: address.state }),
        country: address?.country || EMPTY_COUNTRY,
        ...(address?.postal_code && { postal_code: address.postal_code }),
    };
};

/**
 * Turn (possibly incomplete) customer details into the customer of an invoice preview request,
 * falling back to placeholders for anything the customer has not provided yet.
 */
export const buildCustomerPayload = (customer: Partial<Customer>): GetInvoicePreviewCustomer => {
    const address = buildAddress(customer);
    const type = customer.type ?? 'INDIVIDUAL';

    if (type === 'ORGANIZATION') {
        const organization = 'organization' in customer ? customer.organization : undefined;
        const organizationTaxId = organization?.tax_ids?.[0]?.id;

        return {
            type,
            organization: {
                legal_name: organization?.legal_name || EMPTY_LEGAL_ENTITY_NAME,
                registered_address: address,
                ...(organizationTaxId && {
                    tax_id: taxId.$validator(organizationTaxId, {}, {})
                        ? organizationTaxId
                        : undefined,
                }),
            },
        };
    }

    return {
        type,
        individual: {
            residential_address: address,
        },
    };
};
