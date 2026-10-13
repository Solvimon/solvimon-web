import { isIndividual, isOrganization, isValidCountryCode } from '@solvimon/solvimon-ui';
import { taxId } from '@solvimon/solvimon-ui/validators';
import type { ValidatorFn } from '@vuelidate/core';
import { email, required, requiredIf } from '@vuelidate/validators';
import type { CountryCode, Customer, TaxIdentifier } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import type { BillingInformationFormState } from './BillingInformationForm.types';
import useForm from '@/composables/useForm';
import {
    DEFAULT_TAX_IDENTIFIER_TYPE,
    getRequiredFieldsForCountry,
} from '@/components/customer/CheckoutForm/CheckoutForm.lib';

const isCountryCode = (value: string): value is CountryCode => isValidCountryCode(value);

const DEFAULT_FORM_STATE: BillingInformationFormState = {
    type: 'INDIVIDUAL',
    email: '',
    country: '',
    addressLine1: '',
    postalCode: '',
    city: '',
    state: '',
};

export function useBillingInformationForm<TResult>({
    initialState = {},
    onSubmit,
}: {
    initialState?: Partial<BillingInformationFormState>;
    onSubmit: ({
        customerId,
        payload,
    }: {
        customerId: Customer['id'];
        payload: Partial<Customer>;
    }) => Promise<TResult>;
}) {
    const isRequiredForCountry = (field: 'addressLine1' | 'postalCode' | 'state'): boolean =>
        getRequiredFieldsForCountry(
            isCountryCode(form.value.country) ? form.value.country : undefined,
        ).includes(field);
    const isOrganizationForm = (): boolean => form.value.type === 'ORGANIZATION';

    // The customer's tax ids as stored. The form edits the first one only; the rest are kept.
    const storedTaxIds = ref<TaxIdentifier[]>([]);

    const isVatNumberChanged = (value: string | undefined): boolean =>
        (value?.trim() ?? '') !== (currentInitialState.value.companyVatNumber?.trim() ?? '');

    // A stored tax id may be of a type the format rule does not know, such as `CA_GST_HST`, so
    // the rule only judges a number typed in this edit.
    const changedTaxId: ValidatorFn = (value, siblings, vm) =>
        !isVatNumberChanged(value) || taxId.$validator(value, siblings, vm);

    const {
        form,
        validation,
        changes,
        hasChanges,
        updateInitialState: updateFormInitialState,
        initialState: currentInitialState,
    } = useForm({
        initialState: {
            ...DEFAULT_FORM_STATE,
            ...initialState,
        },
        validationRules: {
            email: { required, email },
            country: { required },
            addressLine1: { required: requiredIf(() => isRequiredForCountry('addressLine1')) },
            postalCode: { required: requiredIf(() => isRequiredForCountry('postalCode')) },
            state: { required: requiredIf(() => isRequiredForCountry('state')) },
            companyLegalName: { required: requiredIf(isOrganizationForm) },
            companyVatNumber: { taxId: { ...taxId, $validator: changedTaxId } },
        },
        nullifyEmptyValues: true,
        mode: 'deep',
    });

    const updateInitialState = (customer: Customer) => {
        storedTaxIds.value = isOrganization(customer) ? (customer.organization.tax_ids ?? []) : [];
        updateFormInitialState(mapCustomerToFormState(customer));
    };

    const submit = (
        customerId: string,
        data: BillingInformationFormState = form.value,
    ): Promise<TResult> => {
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
    };
}

const mapCustomerToFormState = (customer: Customer): BillingInformationFormState => {
    const address = isIndividual(customer)
        ? customer.individual.residential_address
        : customer.organization.registered_address;
    const shared = {
        email: customer.email ?? '',
        country: address?.country ?? '',
        addressLine1: address?.line1 ?? '',
        addressLine2: address?.line2 ?? '',
        postalCode: address?.postal_code ?? '',
        city: address?.city ?? '',
        state: address?.state ?? '',
    };

    if (isIndividual(customer)) {
        return {
            type: 'INDIVIDUAL',
            ...shared,
            firstName: customer.individual.name?.first_name ?? '',
            lastName: customer.individual.name?.last_name ?? '',
        };
    }

    return {
        type: 'ORGANIZATION',
        ...shared,
        companyLegalName: customer.organization.legal_name ?? '',
        companyVatNumber: customer.organization.tax_ids?.[0]?.id ?? '',
    };
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
    data: BillingInformationFormState,
    taxIds: TaxIdentifier[] | undefined,
): Partial<Customer> => {
    const address = {
        line1: data.addressLine1,
        line2: data.addressLine2 ?? '',
        postal_code: data.postalCode,
        city: data.city,
        country: data.country,
        state: data.state ?? '',
    };

    return data.type === 'ORGANIZATION'
        ? {
              type: 'ORGANIZATION' as const,
              email: data.email,
              organization: {
                  legal_name: data.companyLegalName ?? '',
                  ...(taxIds && { tax_ids: taxIds }),
                  registered_address: address,
              },
          }
        : {
              type: 'INDIVIDUAL' as const,
              email: data.email,
              individual: {
                  name: {
                      first_name: data.firstName ?? '',
                      last_name: data.lastName ?? '',
                  },
                  residential_address: address,
              },
          };
};
