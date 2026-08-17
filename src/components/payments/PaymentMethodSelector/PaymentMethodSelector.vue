<script setup lang="ts">
import {
    Button,
    FormMessage,
    PaymentMethod,
    RadioGroupExtended,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
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

/** Nothing can be added when none of the methods is on offer, so the button would lead nowhere. */
const canAddPaymentMethod = computed(() => props.paymentMethodOptions?.length !== 0);
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
            v-if="showAddOption && canAddPaymentMethod"
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

        <Typography
            v-else-if="showAddOption"
            variant="body-sm"
            shade="lighter"
            tag="p"
            class="sv-payment-method-selector__unavailable"
        >
            {{
                $t({
                    defaultMessage:
                        'There are no available payment methods. Please contact support for more information.',
                    description:
                        'Shown in place of the add button when the customer cannot add any payment method',
                    id: 'payment_method_selector.no_payment_methods_available',
                })
            }}
        </Typography>

        <!--
            The group carries the error itself, but it is not rendered when there is nothing to
            choose from — which is exactly when a required method is most likely to be missing. Sits
            below the add button, since adding one is what resolves it.
        -->
        <FormMessage
            v-if="error && !hasPaymentMethods"
            class="sv-payment-method-selector__error"
            :message="error"
            variant="error"
        />
    </div>
</template>
