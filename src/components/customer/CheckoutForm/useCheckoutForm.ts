import { objectDiff, useValidation } from '@solvimon/solvimon-ui';
import { taxId } from '@solvimon/solvimon-ui/validators';
import { email, required, requiredIf } from '@vuelidate/validators';
import { computed, onMounted, ref, toRaw } from 'vue';
import type { CountryCode } from '@solvimon/solvimon-types';
import type { CheckoutFormState } from './CheckoutForm.types';
import { getRequiredFieldsForCountry } from './CheckoutForm.lib';
import { useWatchDebounced } from '@/composables/useWatchDebounced';
import { createGeoLocationService } from '@/services/geolocation';

export function useCheckoutForm({
    initialState,
    onRequiredFieldChange,
}: {
    initialState: Partial<CheckoutFormState>;
    onRequiredFieldChange: (form: CheckoutFormState) => void;
}) {
    const form = ref<CheckoutFormState>(getInitialState(initialState));
    const initialFormState = ref<CheckoutFormState>(getInitialState(initialState));

    const updateInitialState = (state: Partial<CheckoutFormState>) => {
        const newState = getInitialState({ ...form.value, ...state });

        form.value = newState;
        initialFormState.value = structuredClone(toRaw(newState));
    };

    const requiredFields = computed<(keyof CheckoutFormState)[]>(() =>
        getRequiredFieldsForCountry(form.value.country),
    );

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
            companyVatNumber: { taxId },
        },
        form,
    );

    /**
     * When the country is not set in the initial state, get the country from the geo location service.
     */
    const getCountryFromGeoLocationService = (country: CountryCode | undefined) => {
        if (!country) {
            void createGeoLocationService()
                .getGeoLocation()
                .then(({ country }) => {
                    form.value.country = country;
                });
        }
    };

    const handleFormChange = (newValue: CheckoutFormState, oldValue: CheckoutFormState) => {
        const changed = objectDiff({ from: oldValue, to: newValue });
        const fieldName = Object.keys(changed).find(isCheckoutFormStateKey);

        if (!fieldName) {
            return;
        }

        /**
         * These fields are not required, but need to trigger the required field change event,
         * so that we can update the invoice preview accordingly.
         */
        if (['type', 'companyVatNumber'].includes(fieldName)) {
            onRequiredFieldChange(newValue);
            return;
        }

        /**
         * Update when seats values change.
         */
        if (fieldName === 'seatsValues') {
            onRequiredFieldChange(newValue);
            return;
        }

        /**
         * Update when enabled pricing ids change.
         */
        if (fieldName === 'enabledPricingIds') {
            onRequiredFieldChange(newValue);
            return;
        }

        /**
         * Whilst `email` is not required, it needs to trigger the required field change event,
         */
        if (fieldName !== 'email' && getIsFieldRequired(fieldName)) {
            onRequiredFieldChange(newValue);
            return;
        }
    };

    onMounted(async () => {
        await getCountryFromGeoLocationService(initialState?.country);
    });

    useWatchDebounced(() => structuredClone(toRaw(form.value)), handleFormChange, { debounce: 200 });

    return {
        form,
        validation,
        getIsFieldRequired,
        updateInitialState,
        initialState: initialFormState,
    };
}

const getInitialState = (initialState: Partial<CheckoutFormState> = {}): CheckoutFormState => {
    return {
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
        seatsValues: undefined,
        enabledPricingIds: undefined,
        ...initialState,
    };
};

function isCheckoutFormStateKey(key: string): key is keyof CheckoutFormState {
    return key in getInitialState();
}
