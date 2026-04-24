import { type ValidationArgs } from '@vuelidate/core';
import { cloneDeep } from 'lodash-es';
import { computed, ref, type Ref } from 'vue';
import { useValidation, objectDiff } from '@solvimon/ui';

export default <
    T extends object,
    V extends ValidationArgs<unknown> | Ref<ValidationArgs<unknown>>,
>({
    initialState,

    validationRules = {} as V,
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

    const initialFormState = ref<T>(cloneDeep(initialState)) as Ref<T>;

    /**
     * Stores the form values.
     */

    const form = ref<T>(cloneDeep(initialState)) as Ref<T>;

    /**
     * Stores the form validation.
     */
    const validation = useValidation(validationRules, form);

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
        form.value = cloneDeep(state);
        initialFormState.value = cloneDeep(state);
    };

    /**
     * Reset the entire form to the initial form state, normally only applicable
     * when a form keeps mounted after closing or submitting.
     */
    const reset = () => {
        form.value = cloneDeep(initialState);
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
