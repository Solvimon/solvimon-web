<script setup lang="ts">
import { ref, toRaw } from 'vue';
import {
    BankAccountEditor,
    Input,
    Typography,
    useIntl,
    useValidation,
} from '@solvimon/solvimon-ui';
import { maxLength, required } from '@vuelidate/validators';
import type {
    PaymentAcceptorFormProps,
    PaymentAcceptorFormResult,
    PaymentAcceptorFormState,
} from './PaymentAcceptorForm.types';
import {
    createPaymentAcceptorFormState,
    toCreateDetails,
    toPatchPayload,
} from './PaymentAcceptorForm.lib';
import { asText, formControlModel } from '@/utils/formControl';

const props = defineProps<PaymentAcceptorFormProps>();

const { $t } = useIntl();

const initialState = createPaymentAcceptorFormState(props.paymentAcceptor);
const form = ref<PaymentAcceptorFormState>(structuredClone(initialState));

const name = formControlModel(form, 'name', asText);

/** Collects the bank account editor's own rules too, which register under this one. */
const validation = useValidation({ name: { required, maxLength: maxLength(256) } }, form);

defineExpose({
    /**
     * Checks the form and hands back what to store, or nothing while something is missing — the
     * fields say what. Adding gives the details of a new acceptor; editing, the changes to send.
     */
    submit: async (): Promise<PaymentAcceptorFormResult | undefined> => {
        if (!(await validation.value.$validate())) return undefined;

        return props.paymentAcceptor
            ? { method: 'UPDATE', payload: toPatchPayload(initialState, toRaw(form.value)) }
            : { method: 'CREATE', details: toCreateDetails(toRaw(form.value)) };
    },
});
</script>

<template>
    <div class="sv-payment-acceptor-form grid grid-cols-1 gap-4">
        <Input
            v-model="name"
            name="payment_acceptor_name"
            class="sv-payment-acceptor-form__name"
            required
            :disabled="disabled"
            :label="
                $t({
                    defaultMessage: 'Name',
                    id: 'payment_acceptor_form.name.label',
                    description:
                        'Label of the field naming a bank account the customer receives payments on',
                })
            "
            :placeholder="
                $t({
                    defaultMessage: 'For example: Main business account',
                    id: 'payment_acceptor_form.name.placeholder',
                    description:
                        'Placeholder of the name of a bank account the customer is paid on',
                })
            "
            :error="apiError?.name || validation.name.$errors"
        />

        <section class="sv-payment-acceptor-form__bank-account grid grid-cols-1 gap-1">
            <Typography
                tag="h3"
                variant="body-sm"
                weight="semibold"
                no-spacing
                class="sv-payment-acceptor-form__bank-account-title"
                >{{
                    bankAccountTitle ||
                    $t({
                        defaultMessage: 'Bank account',
                        id: 'payment_acceptor_form.bank_account.title',
                        description: 'Heading above the bank account fields of a payment acceptor',
                    })
                }}</Typography
            >

            <div class="grid grid-cols-1 gap-3">
                <BankAccountEditor
                    v-model="form.bank_account"
                    :disabled="disabled"
                    :api-error="apiError"
                    :method="paymentAcceptor ? 'UPDATE' : 'CREATE'"
                />
            </div>
        </section>
    </div>
</template>
