import { isValidCountryCode, objectDiff, useValidation } from '@solvimon/solvimon-ui';
import { taxId } from '@solvimon/solvimon-ui/validators';
import { email, required, requiredIf } from '@vuelidate/validators';
import { computed, onMounted, ref, toRaw } from 'vue';
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
        const newState = getInitialState({ ...toRaw(form.value), ...state });

        form.value = newState;
        initialFormState.value = structuredClone(newState);
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

    const geoLocation = createGeoLocationService();

    /** Fills in the country from the customer's location, unless one is already chosen. */
    const fillCountryFromGeoLocation = async () => {
        try {
            const { country } = await geoLocation.getGeoLocation();
            if (typeof country === 'string' && isValidCountryCode(country) && !form.value.country) {
                form.value.country = country;
            }
        } catch {
            // The customer picks the country instead.
        }
    };

    /** Fields that change the preview without being required for the customer's country. */
    const previewFields: (keyof CheckoutFormState)[] = [
        'type',
        'companyVatNumber',
        'seatsValues',
        'unitsValues',
        'enabledPricingIds',
    ];

    const changesPreview = (fieldName: keyof CheckoutFormState) =>
        previewFields.includes(fieldName) ||
        (fieldName !== 'email' && getIsFieldRequired(fieldName));

    const snapshot = (): CheckoutFormState => JSON.parse(JSON.stringify(form.value));

    // Compared with the form as last handled rather than as before the last change, and every
    // changed field is looked at: several can change within one debounce window.
    let handledForm = snapshot();

    const handleFormChange = (newValue: CheckoutFormState) => {
        const changed = Object.keys(objectDiff({ from: handledForm, to: newValue }));
        handledForm = newValue;

        if (changed.filter(isCheckoutFormStateKey).some(changesPreview)) {
            onRequiredFieldChange(newValue);
        }
    };

    onMounted(() => {
        if (!initialState?.country) {
            void fillCountryFromGeoLocation();
        }
    });

    useWatchDebounced(snapshot, handleFormChange, { debounce: 200 });

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
        unitsValues: undefined,
        enabledPricingIds: undefined,
        ...initialState,
    };
};

function isCheckoutFormStateKey(key: string): key is keyof CheckoutFormState {
    return key in getInitialState();
}
