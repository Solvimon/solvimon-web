import { useIntl } from '@solvimon/solvimon-ui';

/**
 * The labels the checkout form and the billing information form both show. They render the fields
 * differently — sections and validation against a flat form and API errors — but name them the same,
 * so the strings live here rather than in both.
 */
export function useCustomerFormLabels() {
    const { $t } = useIntl();

    return {
        contactInformationTitle: $t({
            defaultMessage: 'Customer information',
            id: 'checkout.contact_information_block.title',
            description: 'The title of the contact information block in the checkout form',
        }),
        emailLabel: $t({
            defaultMessage: 'Email address',
            id: 'checkout.email_address.label',
            description: 'The email address of the customer in the checkout form',
        }),
        emailPlaceholder: $t({
            defaultMessage: 'Email address...',
            id: 'checkout.email_address.placeholder',
            description: 'The email address of the customer in the checkout form',
        }),
        countryLabel: $t({
            defaultMessage: 'Billing country',
            id: 'checkout.country.label',
            description: 'The country of the customer in the checkout form',
        }),
        vatNumberLabel: $t({
            defaultMessage: 'VAT number',
            id: 'checkout.vat_number.label',
            description: 'The label for the vat number in the checkout form',
        }),
        vatNumberPlaceholder: $t({
            defaultMessage: 'VAT number...',
            id: 'checkout.vat_number.placeholder',
            description: 'The label for the vat number in the checkout form',
        }),
        legalNameLabel: $t({
            defaultMessage: 'Legal entity name',
            id: 'checkout.legal_name.label',
            description: 'The legal name of the organization customer in the checkout form',
        }),
        legalNamePlaceholder: $t({
            defaultMessage: 'Legal entity name...',
            id: 'checkout.legal_name.placeholder',
            description: 'The legal name of the organization customer in the checkout form',
        }),
        addressTitle: $t({
            defaultMessage: 'Billing address',
            id: 'checkout.address.title',
            description: 'Address line 1 of the customer address in the checkout form',
        }),
        postalCodePlaceholder: $t({
            defaultMessage: 'Postal code...',
            id: 'checkout.address.portal_code.placeholder',
            description: 'Postal code of the customer address in the checkout form',
        }),
        cityPlaceholder: $t({
            defaultMessage: 'City...',
            id: 'checkout.address.city.placeholder',
            description: 'City of the customer address in the checkout form',
        }),
        statePlaceholder: $t({
            defaultMessage: 'State...',
            id: 'checkout.address.state.placeholder',
            description: 'State of the customer address in the checkout form',
        }),
    };
}
