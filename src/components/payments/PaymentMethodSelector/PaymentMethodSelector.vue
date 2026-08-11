<script setup lang="ts">
import { Button, PaymentMethod, RadioGroupExtended, useIntl } from '@solvimon/solvimon-ui';
import { computed, toRef } from 'vue';
import type {
    PaymentMethodSelectorEmits,
    PaymentMethodSelectorProps,
} from './PaymentMethodSelector.types';
import { usePaymentMethodSelectorOptions } from './usePaymentMethodSelectorOptions';

const props = withDefaults(defineProps<PaymentMethodSelectorProps>(), {
    showAddOption: true,
});
const emit = defineEmits<PaymentMethodSelectorEmits>();

const { $t } = useIntl();

const { options, paymentMethodsById } = usePaymentMethodSelectorOptions(
    toRef(props, 'paymentMethods'),
);

// The group models `string | boolean`; only a payment method id is ever a real selection here.
const selectedValue = computed<string | boolean | undefined>({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', typeof value === 'string' ? value : undefined),
});

const hasPaymentMethods = computed(() => props.paymentMethods.length > 0);
</script>

<template>
    <div class="sv-payment-method-selector grid grid-cols-1 gap-2" :class="rootClass">
        <div>
            <RadioGroupExtended
                v-if="hasPaymentMethods"
                v-model="selectedValue"
                class="sv-payment-method-selector__options"
                name="payment-method"
                direction="column"
                :options="options"
                :label="label"
                :required="required"
                :disabled="disabled"
                :error="error"
                :show-radio="false"
            >
                <template #prefix="{ optionValue }">
                    <PaymentMethod
                        class="sv-payment-method-selector__option-content grow"
                        :payment-method="paymentMethodsById[String(optionValue)]"
                    />
                </template>

                <template #label="{ option }">
                    <span class="sr-only">{{ option.label }}</span>
                </template>
            </RadioGroupExtended>
        </div>

        <Button
            v-if="showAddOption"
            class="sv-action sv-action--secondary sv-action--full-width sv-payment-method-selector__add w-full"
            variant="outline"
            color="gray"
            icon-prefix="add"
            type="button"
            :disabled="disabled"
            @click="emit('add-payment-method')"
        >
            {{
                $t({
                    defaultMessage: 'Add payment method',
                    description: 'Label of the button that adds a new payment method',
                    id: 'payment_method_selector.add_payment_method',
                })
            }}
        </Button>
    </div>
</template>
