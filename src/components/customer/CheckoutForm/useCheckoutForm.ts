import { useValidation } from '@solvimon/ui';
import { email, required, requiredIf } from '@vuelidate/validators';
import { ref } from 'vue';
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

    const validation = useValidation(
        {
            email: { required, email },
            country: { required },
            companyLegalName: requiredIf(form.value.type === 'ORGANIZATION'),
        },
        form
    );

    return { form, validation };
}
