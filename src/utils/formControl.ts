import { computed, type Ref, type WritableComputedRef } from 'vue';

/**
 * What the Solvimon UI text controls report through `update:modelValue`. `Input` is typed for every
 * input kind it supports, so a single text field is handed far more than it can hold.
 *
 * A `v-model` binding is checked against this payload rather than against the control's own prop,
 * and against the bound expression's own type rather than a setter's, so a field typed narrower
 * than the payload cannot be bound directly. Bind a {@link formControlModel} instead.
 */
export type TextControlValue = string | number | string[] | null | undefined;

/** What `CountrySelect` and `SelectExtended` report: a cleared selection arrives as `null`. */
export type SelectControlValue = string | null | undefined;

/**
 * The text a control reported. Only strings reach a text field in practice; the rest of the payload
 * is coerced rather than rejected, so a control that widens further cannot blank the field.
 */
export function asText(value: TextControlValue): string {
    if (typeof value === 'string') {
        return value;
    }

    return typeof value === 'number' ? String(value) : '';
}

/**
 * As {@link asText}, but keeps "nothing reported" distinct from an emptied field: a cleared text
 * input reports `''` and is stored as such, where a control that reports nothing stores `undefined`.
 */
export function asOptionalText(value: TextControlValue): string | undefined {
    return value === null || value === undefined ? undefined : asText(value);
}

/**
 * A writable `v-model` binding for one field of `state`, reading it as the control's own payload
 * type and narrowing on the way back.
 *
 * Collect a form's fields in a `reactive()` object so the template can bind them directly: a
 * template unwraps refs bound straight to the setup scope, but not refs nested in a plain object.
 */
export function formControlModel<K extends string, T extends Partial<Record<K, TextControlValue>>>(
    state: Ref<T>,
    field: K,
    narrow: (value: TextControlValue) => T[K],
): WritableComputedRef<TextControlValue> {
    return computed<TextControlValue>({
        get: () => state.value[field],
        set: (value) => {
            state.value[field] = narrow(value);
        },
    });
}
