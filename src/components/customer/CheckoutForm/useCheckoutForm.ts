import { useValidation } from '@solvimon/ui';
import { email, required, requiredIf } from '@vuelidate/validators';
import { computed, ref } from 'vue';
import type { CheckoutFormState } from './CheckoutForm.types';

export function useCheckoutForm(initialState: Partial<CheckoutFormState>) {
    const form = ref<CheckoutFormState>({
        email: undefined,
        country: undefined,
        type: 'INDIVIDUAL',
        companyLegalName: undefined,
        firstName: undefined,
        infix: undefined,
        lastName: undefined,
        addressLine1: undefined,
        addressLine2: undefined,
        postalCode: undefined,
        city: undefined,
        state: undefined,
        companyVatNumber: undefined,
        ...(initialState || {}),
    });

    const requiredFields = computed<(keyof CheckoutFormState)[]>(() => {
        if (form.value.country === 'US') {
            return ['email', 'country', 'addressLine1', 'postalCode'];
        }

        if (form.value.country === 'CA') {
            return ['email', 'country', 'state'];
        }

        return ['email', 'country'];
    });

    const getIsFieldRequired = (field: keyof CheckoutFormState): boolean =>
        requiredFields.value.includes(field);

    const validation = useValidation(
        {
            email: { required, email },
            country: { required },
            state: { required: requiredIf(() => getIsFieldRequired('state')) },
            addressLine1: { required: requiredIf(() => getIsFieldRequired('addressLine1')) },
            postalCode: { required: requiredIf(() => getIsFieldRequired('postalCode')) },
            companyLegalName: requiredIf(form.value.type === 'ORGANIZATION'),
        },
        form,
    );

    return { form, validation, getIsFieldRequired };
}
