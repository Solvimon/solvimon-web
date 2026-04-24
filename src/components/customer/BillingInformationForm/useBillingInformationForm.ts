import { isIndividual, isOrganization } from '@solvimon/ui';
import { email, required } from '@vuelidate/validators';
import type { Customer } from '@solvimon/types';
import type { BillingInformationFormState } from './BillingInformationForm.types';
import useForm from '@/composables/useForm';

const DEFAULT_FORM_STATE: BillingInformationFormState = {
    type: 'INDIVIDUAL',
    email: '',
    country: '',
    addressLine1: '',
    postalCode: '',
    city: '',
    state: '',
};

export function useBillingInformationForm({
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
    }) => Promise<unknown>;
}) {
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
        },
        nullifyEmptyValues: true,
        mode: 'deep',
    });

    const updateInitialState = (customer: Customer) => {
        updateFormInitialState(mapCustomerToFormState(customer));
    };

    const submit = (customerId: string, data: BillingInformationFormState = form.value) => {
        return onSubmit({
            customerId,
            payload: mapFormStateToCustomerPayload(data),
        });
    };

    return {
        form,
        isOrganization,
        validation,
        changes,
        hasChanges,
        updateInitialState,
        submit,
        initialState: currentInitialState,
    };
}

const mapCustomerToFormState = (customer: Customer): BillingInformationFormState => {
    if (isIndividual(customer)) {
        const address = customer.individual.residential_address;

        return {
            type: 'INDIVIDUAL',
            email: customer.email ?? '',
            country: address?.country ?? '',
            addressLine1: address?.line1 ?? '',
            addressLine2: address?.line2 ?? '',
            postalCode: address?.postal_code ?? '',
            city: address?.city ?? '',
            state: address?.state ?? '',
            firstName: customer.individual.name?.first_name ?? '',
            lastName: customer.individual.name?.last_name ?? '',
        };
    }

    const address = customer.organization.registered_address;

    return {
        type: 'ORGANIZATION',
        email: customer.email ?? '',
        country: address?.country ?? '',
        addressLine1: address?.line1 ?? '',
        addressLine2: address?.line2 ?? '',
        postalCode: address?.postal_code ?? '',
        city: address?.city ?? '',
        state: address?.state ?? '',
        companyLegalName: customer.organization.legal_name ?? '',
        companyVatNumber: customer.organization.tax_id ?? '',
    };
};

const mapFormStateToCustomerPayload = (data: BillingInformationFormState): Partial<Customer> =>
    data.type === 'ORGANIZATION'
        ? {
              type: 'ORGANIZATION' as const,
              email: data.email,
              organization: {
                  legal_name: data.companyLegalName ?? '',
                  tax_id: data.companyVatNumber ?? '',
                  registered_address: {
                      line1: data.addressLine1,
                      line2: data.addressLine2 ?? '',
                      postal_code: data.postalCode,
                      city: data.city,
                      country: data.country,
                      state: data.state ?? '',
                  },
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
                  residential_address: {
                      line1: data.addressLine1,
                      line2: data.addressLine2 ?? '',
                      postal_code: data.postalCode,
                      city: data.city,
                      country: data.country,
                      state: data.state ?? '',
                  },
              },
          };
