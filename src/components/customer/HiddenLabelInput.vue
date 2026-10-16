<script setup lang="ts">
import { FormMessage, Input } from '@solvimon/solvimon-ui';
import type { ErrorObject } from '@vuelidate/core';
import { computed, useId } from 'vue';
import type { TextControlValue } from '@/utils/formControl';

/**
 * An `Input` named for assistive technology only. `Input`'s own label adds a row above the field,
 * with an untranslated "(optional)", so the label is ours and the error goes below the field.
 */
const props = defineProps<{
    label: string;
    name: string;
    placeholder?: string;
    error?: string | ErrorObject[];
    autocomplete?: string;
}>();

const model = defineModel<TextControlValue>();

const id = useId();

const hasError = computed(() =>
    Array.isArray(props.error) ? !!props.error.length : !!props.error,
);
</script>

<template>
    <div>
        <label :for="id" class="sr-only">{{ label }}</label>
        <Input
            :id="id"
            v-model="model"
            :name="name"
            :placeholder="placeholder"
            :error="error"
            :autocomplete="autocomplete"
        >
            <template v-if="hasError" #helper>
                <FormMessage :message="error" />
            </template>
        </Input>
    </div>
</template>
