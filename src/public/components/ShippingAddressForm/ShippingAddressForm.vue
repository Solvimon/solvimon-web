<script setup lang="ts">
import { computed, ref } from 'vue';
import { Button, ErrorNotification, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { Customer, ShippingAddress } from '@solvimon/solvimon-types';
import InternalShippingAddressForm from '@/components/customer/ShippingAddressForm/ShippingAddressForm.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useLogger } from '@/components/providers';
import { useHostEvent } from '@/components/providers/HostElementProvider/composables/useHostEvent';
import type {
    ShippingAddressReplacement,
    UseShippingAddresses,
} from '@/composables/useShippingAddresses';

const props = defineProps<{
    customer?: Customer;
    /** The address being edited; left out, a new one is added. */
    address?: ShippingAddress;
    /** Set when the address to edit is not among the customer's. */
    isAddressMissing?: boolean;
    isLoading?: boolean;
    actions: Pick<UseShippingAddresses, 'create' | 'replace'>;
}>();

const { $t } = useIntl();
const logger = useLogger();
const { dispatch, componentName } = useHostEvent();

const formRef = ref<InstanceType<typeof InternalShippingAddressForm>>();
const isSaving = ref(false);
const hasSaveFailed = ref(false);

/** The address the next save replaces: the one edited, or the one this form stored already. */
const saved = ref<ShippingAddress>();
const target = computed(() => saved.value ?? props.address);
/** How far replacing the target got, which a retry carries on from. */
let replacement: ShippingAddressReplacement = {};

const title = computed(() =>
    props.address
        ? $t({
              defaultMessage: 'Edit shipping address',
              id: 'components.shipping_address_form.edit.title',
              description: 'Title of the shipping address form while a stored address is edited',
          })
        : $t({
              defaultMessage: 'Add shipping address',
              id: 'components.shipping_address_form.add.title',
              description: 'Title of the shipping address form while a new address is added',
          }),
);

const save = async () => {
    // A second save while the first is out would store the address twice.
    if (isSaving.value) return;

    isSaving.value = true;
    hasSaveFailed.value = false;

    try {
        const payload = await formRef.value?.submit();
        if (!payload) return;

        const editing = target.value;
        const result = editing
            ? await props.actions.replace(editing, payload, replacement)
            : await props.actions.create(payload);

        saved.value = result;
        replacement = {};
        dispatch('solvimon-shipping-address-saved', {
            componentName,
            shippingAddressId: result.id,
        });
    } catch (error) {
        logger.error(
            'SHIPPING_ADDRESS_SAVE_FAILED',
            'Failed to save the shipping address',
            {},
            error,
        );
        hasSaveFailed.value = true;
    } finally {
        isSaving.value = false;
    }
};
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="sv-shipping-address-form sv-root sv-component sv-loading min-h-[200px]"
    />
    <ErrorNotification
        v-else-if="isAddressMissing"
        class="sv-shipping-address-form sv-root sv-component sv-error"
        :title="
            $t({
                defaultMessage: 'We could not find this shipping address.',
                id: 'components.shipping_address_form.not_found',
                description:
                    'Shown instead of the shipping address form when the address to edit is not among the customer’s',
            })
        "
    />
    <form
        v-else-if="customer"
        class="sv-shipping-address-form sv-root sv-component"
        @submit.prevent="save"
    >
        <Typography variant="heading-3" tag="h2">{{ title }}</Typography>

        <InternalShippingAddressForm
            ref="formRef"
            :customer="customer"
            :address="address"
            :disabled="isSaving"
        />

        <ErrorNotification
            v-if="hasSaveFailed"
            class="sv-error mt-4"
            :title="
                $t({
                    defaultMessage: 'Something went wrong. Please try again.',
                    id: 'shipping_addresses_modal.error',
                    description:
                        'Error shown in the shipping addresses modal when a change cannot be made',
                })
            "
        />

        <Button type="submit" intent="primary" :loading="isSaving" class="mt-4">{{
            $t({
                defaultMessage: 'Save address',
                id: 'shipping_addresses_modal.save_button.label',
                description: 'Label of the button that stores a new or changed shipping address',
            })
        }}</Button>
    </form>
</template>
