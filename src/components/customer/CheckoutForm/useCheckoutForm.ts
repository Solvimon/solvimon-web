import { isValidCountryCode, objectDiff, useValidation } from '@solvimon/solvimon-ui';
import { taxId } from '@solvimon/solvimon-ui/validators';
import { email, required, requiredIf } from '@vuelidate/validators';
import {
    computed,
    onMounted,
    ref,
    shallowRef,
    toRaw,
    watch,
    type MaybeRefOrGetter,
    toValue,
} from 'vue';
import type { CheckoutFormState } from './CheckoutForm.types';
import {
    getAddressFormat,
    isPhoneNumberPlausible,
    isPostalCodeValid,
    loadAddressFormats,
    type AddressFormat,
    type AddressFormatTable,
} from './addressFormat';
import {
    ADDRESS_KEYS,
    billingAddressFromShipping,
    getRequiredAddressFields,
    getRequiredFieldsForCountry,
    getTaxedAddressFields,
    isVatNumberShown,
    type AddressVariant,
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
    isShippingAddressRequired?: MaybeRefOrGetter<boolean>;
}) {
    const isShipped = computed<boolean>(() => toValue(isShippingAddressRequired) ?? false);

    const form = ref<CheckoutFormState>(getInitialState(initialState));
    const initialFormState = ref<CheckoutFormState>(getInitialState(initialState));

    // Otherwise the billing address, which follows the shipping one, would start out blank.
    if (isShipped.value && !form.value.shippingCountry) {
        form.value.shippingCountry = form.value.country;
        initialFormState.value.shippingCountry = form.value.country;
    }

    const updateInitialState = (state: Partial<CheckoutFormState>) => {
        const newState = getInitialState({ ...toRaw(form.value), ...state });

        form.value = newState;
        initialFormState.value = structuredClone(newState);
    };

    const addressFormats = shallowRef<AddressFormatTable>();

    let isLoadingAddressFormats = false;

    // A failed download is tried again on the next country change.
    watch(
        [isShipped, () => form.value.shippingCountry, () => form.value.country],
        ([shipped]) => {
            if (!shipped || addressFormats.value || isLoadingAddressFormats) return;

            isLoadingAddressFormats = true;
            loadAddressFormats()
                .then((formats) => {
                    addressFormats.value = formats;
                })
                .catch(() => {
                    // The fallback rules apply until then.
                })
                .finally(() => {
                    isLoadingAddressFormats = false;
                });
        },
        { immediate: true },
    );

    const formatOf = (country: string | undefined): AddressFormat | undefined =>
        addressFormats.value ? getAddressFormat(addressFormats.value, country) : undefined;

    const shippingAddressFormat = computed(() => formatOf(form.value.shippingCountry));

    const isBillingAddressSeparate = computed<boolean>(
        () => isShipped.value && !form.value.billingAddressSameAsShipping,
    );

    const billingAddressFormat = computed(() =>
        isBillingAddressSeparate.value ? formatOf(form.value.country) : undefined,
    );

    const requiredFields = computed<(keyof CheckoutFormState)[]>(() => {
        const recipient: (keyof CheckoutFormState)[] =
            form.value.type === 'ORGANIZATION' ? [] : ['shippingLastName'];

        return [
            ...getRequiredFieldsForCountry(form.value.country),
            ...(isShipped.value
                ? [
                      ...getRequiredAddressFields(
                          'SHIPPING',
                          form.value.shippingCountry,
                          shippingAddressFormat.value,
                      ),
                      'shippingPhoneNumber' as const,
                      ...recipient,
                  ]
                : []),
            ...(isBillingAddressSeparate.value
                ? getRequiredAddressFields(
                      'BILLING',
                      form.value.country,
                      billingAddressFormat.value,
                  )
                : []),
        ];
    });

    const getIsFieldRequired = (field: keyof CheckoutFormState): boolean =>
        requiredFields.value.includes(field);

    const isPostalCodeValidFor =
        (format: () => AddressFormat | undefined) =>
        (value: unknown): boolean => {
            const addressFormat = format();
            return (
                typeof value !== 'string' ||
                !value.trim() ||
                !addressFormat ||
                isPostalCodeValid(addressFormat, value)
            );
        };

    const requiredWhenAsked = (field: keyof CheckoutFormState) => ({
        required: requiredIf(() => getIsFieldRequired(field)),
    });

    const addressRules = (variant: AddressVariant, format: () => AddressFormat | undefined) => {
        const keys = ADDRESS_KEYS[variant];
        return {
            [keys.line1]: requiredWhenAsked(keys.line1),
            [keys.city]: requiredWhenAsked(keys.city),
            [keys.state]: requiredWhenAsked(keys.state),
            [keys.country]: requiredWhenAsked(keys.country),
            [keys.postalCode]: {
                ...requiredWhenAsked(keys.postalCode),
                postalCodeFormat: {
                    $validator: isPostalCodeValidFor(format),
                    $message: 'The postal code does not match the country',
                },
            },
        };
    };

    // A hidden VAT number is not checked: the customer could not see or correct it.
    const validation = useValidation(
        computed(() => ({
            ...addressRules('BILLING', () => billingAddressFormat.value),
            ...addressRules('SHIPPING', () => shippingAddressFormat.value),
            email: { required, email },
            country: { required },
            companyLegalName: {
                required: requiredIf(() => form.value.type === 'ORGANIZATION'),
            },
            companyVatNumber: isVatNumberShown(form.value) ? { taxId } : {},
            shippingPhoneNumber: {
                ...requiredWhenAsked('shippingPhoneNumber'),
                phoneNumberFormat: {
                    $validator: (value: unknown) =>
                        typeof value !== 'string' || !value.trim() || isPhoneNumberPlausible(value),
                    $message: 'The phone number is not valid',
                },
            },
            shippingLastName: requiredWhenAsked('shippingLastName'),
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

    // A shipped order is priced where it ships, so its billing address does not move the price.
    const changesPreview = (fieldName: keyof CheckoutFormState) =>
        previewFields.includes(fieldName) ||
        (isShipped.value
            ? getTaxedAddressFields('SHIPPING', form.value.shippingCountry)
            : getTaxedAddressFields('BILLING', form.value.country)
        ).includes(fieldName);

    const snapshot = (): CheckoutFormState => JSON.parse(JSON.stringify(form.value));

    // Compared with the form as last handled rather than as before the last change, and every
    // changed field is looked at: several can change within one debounce window.
    let handledForm = snapshot();

    const changesPreviewSinceHandled = (value: CheckoutFormState) =>
        Object.keys(objectDiff({ from: handledForm, to: value }))
            .filter(isCheckoutFormStateKey)
            .some(changesPreview);

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
            shippingAddressFormat.value,
        ],
        () => {
            if (!isShipped.value || !form.value.billingAddressSameAsShipping) {
                return;
            }

            // Assigned field by field: replacing the state would retrigger this watcher on its
            // own dependency and loop.
            Object.assign(
                form.value,
                billingAddressFromShipping(form.value, shippingAddressFormat.value),
            );
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
        shippingAddressFormat,
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
        shippingPhoneNumber: undefined,
        shippingFirstName: undefined,
        shippingLastName: undefined,
        shippingAttentionName: undefined,
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
