import { type ValidationArgs } from '@vuelidate/core';
import { computed, ref, shallowRef, toRaw } from 'vue';
import type { Ref } from 'vue';
import { useValidation, objectDiff } from '@solvimon/solvimon-ui';

export default <
    T extends object,
    V extends ValidationArgs<unknown> | Ref<ValidationArgs<unknown>>,
>({
    initialState,

    validationRules,
    nullifyEmptyValues = false,
    mode = 'shallow',
}: {
    initialState: T;
    validationRules?: V;
    nullifyEmptyValues?: boolean;
    mode?: 'shallow' | 'deep';
}) => {
    /**
     * Stores the initial form state.
     */

    const initialFormState = shallowRef<T>(structuredClone(initialState));

    /**
     * Stores the form values. Deep, because fields are edited in place.
     */

    // A form state holds no refs, so unwrapping them leaves `T` as it is.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const form = ref(structuredClone(initialState)) as Ref<T>;

    /**
     * Stores the form validation.
     */
    const validation = useValidation(validationRules ?? {}, form);

    const changes = computed(() =>
        objectDiff<T>({ from: initialFormState.value, to: form.value, mode, nullifyEmptyValues }),
    );

    /**
     * Stores wether or not there are changes based on the initial form state.
     */
    const hasChanges = computed(() => Object.entries(changes.value).length > 0);

    /**
     * Updates the initial form state. Convenient in cases where we edit data, so
     * we can set the initial form state after getting said data.
     *
     * This deep-copies the provided state into both `form.value` and
     * `initialFormState.value`.
     * After that:
     * - `changes` becomes empty because `from` and `to` are equal
     * - `hasChanges` becomes `false`
     */
    const updateInitialState = (state: T) => {
        form.value = structuredClone(toRaw(state));
        initialFormState.value = structuredClone(toRaw(state));
    };

    /**
     * Reset the entire form to the initial form state, normally only applicable
     * when a form keeps mounted after closing or submitting.
     */
    const reset = () => {
        form.value = structuredClone(initialState);
        validation.value.$reset();
    };

    return {
        form,
        validation,
        changes,
        hasChanges,
        reset,
        updateInitialState,
        initialState: initialFormState,
    };
};
