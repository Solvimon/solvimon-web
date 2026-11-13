import { isIndividual, isOrganization } from '@solvimon/solvimon-ui';
import { taxId } from '@solvimon/solvimon-ui/validators';
import type { ValidatorFn } from '@vuelidate/core';
import { email, required, requiredIf } from '@vuelidate/validators';
import type { Customer, TaxIdentifier } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import useForm from '@/composables/useForm';
import type { CheckoutFormState } from '@/components/customer/CheckoutForm/CheckoutForm.types';
import {
    DEFAULT_TAX_IDENTIFIER_TYPE,
    getInitialState,
    getRequiredFieldsForCountry,
    isVatNumberShown,
} from '@/components/customer/CheckoutForm/CheckoutForm.lib';
import { addressRules } from '@/components/customer/CheckoutForm/addressRules';
import { useAddressFormats } from '@/components/customer/CheckoutForm/useAddressFormats';
import type { AddressFormat } from '@/components/customer/CheckoutForm/addressFormat';
import { isCountryCode } from '@/utils/countryCode';

export function useBillingInformationForm<TResult>({
    initialState = {},
    onSubmit,
}: {
    initialState?: Partial<CheckoutFormState>;
    onSubmit: ({
        customerId,
        payload,
    }: {
        customerId: Customer['id'];
        payload: Partial<Customer>;
    }) => Promise<TResult>;
}) {
    // What the checkout asks of a billing address that is not also shipped to, so a customer is
    // never held to more here than when they bought.
    const isRequired = (field: keyof CheckoutFormState): boolean =>
        getRequiredFieldsForCountry(form.value.country).includes(field);
    const isOrganizationForm = (): boolean => form.value.type === 'ORGANIZATION';

    // The customer's tax ids as stored. The form edits the first one only; the rest are kept.
    const storedTaxIds = ref<TaxIdentifier[]>([]);

    const isVatNumberChanged = (value: string | undefined): boolean =>
        (value?.trim() ?? '') !== (currentInitialState.value.companyVatNumber?.trim() ?? '');

    // A stored tax id may be of a type the format rule does not know, such as `CA_GST_HST`, so
    // the rule only judges a number typed in this edit. A hidden one is not checked: the customer
    // could not see or correct it.
    const changedTaxId: ValidatorFn = (value, siblings, vm) =>
        !isVatNumberShown(form.value) ||
        !isVatNumberChanged(value) ||
        taxId.$validator(value, siblings, vm);

    const {
        form,
        validation,
        changes,
        hasChanges,
        updateInitialState: updateFormInitialState,
        initialState: currentInitialState,
    } = useForm({
        initialState: getInitialState(initialState),
        validationRules: {
            ...addressRules(
                'BILLING',
                (): AddressFormat | undefined => formatOf(form.value.country),
                isRequired,
            ),
            email: { required, email },
            country: { required },
            companyLegalName: { required: requiredIf(isOrganizationForm) },
            companyVatNumber: { taxId: { ...taxId, $validator: changedTaxId } },
        },
        nullifyEmptyValues: true,
        mode: 'deep',
    });

    const { formatOf } = useAddressFormats({
        isNeeded: () => true,
        countries: [() => form.value.country],
    });

    const updateInitialState = (customer: Customer) => {
        storedTaxIds.value = isOrganization(customer) ? (customer.organization.tax_ids ?? []) : [];
        updateFormInitialState(mapCustomerToFormState(customer));
    };

    const submit = (customerId: string, data: CheckoutFormState = form.value): Promise<TResult> => {
        return onSubmit({
            customerId,
            payload: mapFormStateToCustomerPayload(
                data,
                isVatNumberChanged(data.companyVatNumber)
                    ? getTaxIds(storedTaxIds.value, data.companyVatNumber)
                    : undefined,
            ),
        });
    };

    return {
        form,
        validation,
        changes,
        hasChanges,
        updateInitialState,
        submit,
        isRequired,
    };
}

const mapCustomerToFormState = (customer: Customer): CheckoutFormState => {
    const address = isIndividual(customer)
        ? customer.individual.residential_address
        : customer.organization.registered_address;
    const shared = {
        email: customer.email || undefined,
        country: address?.country && isCountryCode(address.country) ? address.country : undefined,
        addressLine1: address?.line1 || undefined,
        addressLine2: address?.line2 || undefined,
        postalCode: address?.postal_code || undefined,
        city: address?.city || undefined,
        state: address?.state || undefined,
    };

    if (isIndividual(customer)) {
        return getInitialState({
            type: 'INDIVIDUAL',
            ...shared,
            firstName: customer.individual.name?.first_name || undefined,
            lastName: customer.individual.name?.last_name || undefined,
        });
    }

    return getInitialState({
        type: 'ORGANIZATION',
        ...shared,
        companyLegalName: customer.organization.legal_name || undefined,
        companyVatNumber: customer.organization.tax_ids?.[0]?.id || undefined,
    });
};

const toTaxIdPayload = ({ id, type, display_name }: TaxIdentifier): TaxIdentifier => ({
    id,
    type,
    ...(display_name && { display_name }),
});

/**
 * The tax ids to send once the VAT number was edited. The API replaces the whole list, so the
 * other stored ids go along unchanged, and the edited one keeps its type. An emptied field removes
 * that one id only.
 */
const getTaxIds = (stored: TaxIdentifier[], vatNumber: string | undefined): TaxIdentifier[] => {
    const id = vatNumber?.trim();
    const [first, ...rest] = stored.map(toTaxIdPayload);

    if (!id) {
        return rest;
    }

    return [{ ...first, id, type: first?.type ?? DEFAULT_TAX_IDENTIFIER_TYPE }, ...rest];
};

/** Leaving `taxIds` out leaves the stored tax ids as they are. */
const mapFormStateToCustomerPayload = (
    data: CheckoutFormState,
    taxIds: TaxIdentifier[] | undefined,
): Partial<Customer> => {
    // Empty strings rather than nothing, so an emptied field clears what is stored.
    const address = {
        line1: data.addressLine1 ?? '',
        line2: data.addressLine2 ?? '',
        postal_code: data.postalCode ?? '',
        city: data.city ?? '',
        country: data.country ?? '',
        state: data.state ?? '',
    };

    return data.type === 'ORGANIZATION'
        ? {
              type: 'ORGANIZATION' as const,
              email: data.email ?? '',
              organization: {
                  legal_name: data.companyLegalName ?? '',
                  ...(taxIds && { tax_ids: taxIds }),
                  registered_address: address,
              },
          }
        : {
              type: 'INDIVIDUAL' as const,
              email: data.email ?? '',
              individual: {
                  name: {
                      first_name: data.firstName ?? '',
                      last_name: data.lastName ?? '',
                  },
                  residential_address: address,
              },
          };
};
