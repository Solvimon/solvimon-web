import { isValidCountryCode, objectDiff, useValidation } from '@solvimon/solvimon-ui';
import { taxId } from '@solvimon/solvimon-ui/validators';
import { email, required, requiredIf } from '@vuelidate/validators';
import { computed, onMounted, ref, toRaw, watch, type MaybeRefOrGetter, toValue } from 'vue';
import type { CheckoutFormState } from './CheckoutForm.types';
import {
    getRequiredFieldsForCountry,
    getRequiredShippingFieldsForCountry,
    billingAddressFromShipping,
    isVatNumberShown,
    type ShippingField,
} from './CheckoutForm.lib';
import { useWatchDebounced } from '@/composables/useWatchDebounced';
import { createGeoLocationService } from '@/services/geolocation';

export function useCheckoutForm({
    initialState,
    onRequiredFieldChange,
    isShippingAddressRequired,
}: {
    initialState: Partial<CheckoutFormState>;
    onRequiredFieldChange: (form: CheckoutFormState) => void;
    /** Whether the order is shipped, which the portal decides. */
    isShippingAddressRequired?: MaybeRefOrGetter<boolean>;
}) {
    const isShipped = computed<boolean>(() => toValue(isShippingAddressRequired) ?? false);

    const form = ref<CheckoutFormState>(getInitialState(initialState));
    const initialFormState = ref<CheckoutFormState>(getInitialState(initialState));

    // A shipped order opens on the country the host configured, so the billing address that
    // follows the shipping one is not blanked before the customer has filled anything in.
    if (isShipped.value && !form.value.shippingCountry) {
        form.value.shippingCountry = form.value.country;
        initialFormState.value.shippingCountry = form.value.country;
    }

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

    /** The destination country answers for the shipping address, not the billing one. */
    const requiredShippingFields = computed<ShippingField[]>(() =>
        isShipped.value ? getRequiredShippingFieldsForCountry(form.value.shippingCountry) : [],
    );

    const getIsShippingFieldRequired = (field: ShippingField): boolean =>
        requiredShippingFields.value.includes(field);

    // A hidden VAT number is not checked: the customer could not see or correct it.
    const validation = useValidation(
        computed(() => ({
            email: { required, email },
            country: { required },
            state: { required: requiredIf(() => getIsFieldRequired('state')) },
            addressLine1: { required: requiredIf(() => getIsFieldRequired('addressLine1')) },
            postalCode: { required: requiredIf(() => getIsFieldRequired('postalCode')) },
            companyLegalName: {
                required: requiredIf(() => form.value.type === 'ORGANIZATION'),
            },
            companyVatNumber: isVatNumberShown(form.value) ? { taxId } : {},
            shippingAddressLine1: {
                required: requiredIf(() => getIsShippingFieldRequired('shippingAddressLine1')),
            },
            shippingPostalCode: {
                required: requiredIf(() => getIsShippingFieldRequired('shippingPostalCode')),
            },
            shippingCity: {
                required: requiredIf(() => getIsShippingFieldRequired('shippingCity')),
            },
            shippingState: {
                required: requiredIf(() => getIsShippingFieldRequired('shippingState')),
            },
            shippingCountry: {
                required: requiredIf(() => getIsShippingFieldRequired('shippingCountry')),
            },
        })),
        form,
    );

    const geoLocation = createGeoLocationService();

    /** Fills in the country from the customer's location, unless one is already chosen. */
    const fillCountryFromGeoLocation = async () => {
        try {
            const { country } = await geoLocation.getGeoLocation();
            if (typeof country !== 'string' || !isValidCountryCode(country)) {
                return;
            }
            if (!form.value.country) {
                form.value.country = country;
            }
            // A shipped order opens on the same guess, which the billing address then follows
            // while it is billed to where it ships.
            if (isShipped.value && !form.value.shippingCountry) {
                form.value.shippingCountry = country;
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

    const changesPreviewSinceHandled = (value: CheckoutFormState) =>
        Object.keys(objectDiff({ from: handledForm, to: value }))
            .filter(isCheckoutFormStateKey)
            .some(changesPreview);

    /**
     * Keep the billing address on the shipping one while the customer asks to be billed there.
     * Everything downstream — the invoice preview, the customer the order is placed against — reads
     * the billing fields, so the copy happens here rather than in each of them.
     */
    watch(
        () => [
            isShipped.value,
            form.value.billingAddressSameAsShipping,
            form.value.shippingAddressLine1,
            form.value.shippingAddressLine2,
            form.value.shippingPostalCode,
            form.value.shippingCity,
            form.value.shippingState,
            form.value.shippingCountry,
        ],
        () => {
            if (!isShipped.value || !form.value.billingAddressSameAsShipping) {
                return;
            }

            // Assigned field by field: replacing the state would retrigger this watcher on its
            // own dependency and loop.
            Object.assign(form.value, billingAddressFromShipping(form.value));
        },
        { immediate: true },
    );

    /**
     * A change to the price the preview has not been asked for yet: the debounce holds it back,
     * and until it is asked for, the preview on screen is of the form before it.
     */
    const isPreviewStale = ref(false);

    const handleFormChange = (newValue: CheckoutFormState) => {
        const changesPrice = changesPreviewSinceHandled(newValue);
        handledForm = newValue;
        isPreviewStale.value = false;

        if (changesPrice) {
            onRequiredFieldChange(newValue);
        }
    };

    watch(
        snapshot,
        (value) => {
            isPreviewStale.value = changesPreviewSinceHandled(value);
        },
        { flush: 'sync' },
    );

    /** Asks now for the preview of a change the debounce still holds back. */
    const flushPreviewChange = () => {
        if (isPreviewStale.value) {
            handleFormChange(snapshot());
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
        getIsShippingFieldRequired,
        updateInitialState,
        initialState: initialFormState,
        isPreviewStale,
        flushPreviewChange,
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
        shippingAddressLine1: undefined,
        shippingAddressLine2: undefined,
        shippingPostalCode: undefined,
        shippingCity: undefined,
        shippingState: undefined,
        shippingCountry: undefined,
        // Most customers are billed where they are shipped, so that is what the form opens on.
        billingAddressSameAsShipping: true,
        seatsValues: undefined,
        unitsValues: undefined,
        enabledPricingIds: undefined,
        ...initialState,
    };
};

function isCheckoutFormStateKey(key: string): key is keyof CheckoutFormState {
    return key in getInitialState();
}
