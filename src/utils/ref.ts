import type { Ref } from 'vue';
import { isEqual } from '@/utils/comparison';

/**
 * Utility function to update a ref if the value is different from the current value,
 * this is useful to avoid unnecessary re-renders.
 */
export function updateRefIfChanged<T>(ref: Ref<T>, value: T) {
    if (isEqual(ref.value, value)) {
        return;
    }

    ref.value = value;
}
