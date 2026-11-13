<script setup lang="ts">
import { Button, CustomerBillingInformation, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { BillingInformationProps } from './BillingInformation.types';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useActionDispatchProvider } from '@/components/providers';
import { resolveConfiguration } from '@/utils/configuration';
import { hasBillingAddress } from '@/components/customer/BillingInformationForm/BillingInformationForm.lib';

const DEFAULT_CONFIGURATION = {
    showEditButton: true,
};

const props = defineProps<
    BillingInformationProps & {
        /** Edits in place, as the customer overview does; without it the host is asked to. */
        onEdit?: () => void;
    }
>();

const configuration = computed(() =>
    resolveConfiguration(DEFAULT_CONFIGURATION, props.configuration),
);

const { $t } = useIntl();

const hasAddress = computed(() => hasBillingAddress(props.customer));
const { dispatchAction } = useActionDispatchProvider();
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="sv-billing-information sv-root sv-component sv-loading min-h-[100px]"
        data-testid="billing-information-skeleton"
    />
    <CustomerBillingInformation
        v-else
        class="sv-billing-information sv-root sv-component"
        :customer="customer"
        :fallback-to-reference="false"
    >
        <template v-if="configuration.showEditButton" #settings>
            <Button
                size="xs"
                intent="subtle"
                :icon-prefix="hasAddress ? 'edit' : 'add'"
                class="sv-action sv-action--ghost sv-billing-information__edit"
                @click="onEdit ? onEdit() : dispatchAction({ action: 'edit-billing-information' })"
                >{{
                    hasAddress
                        ? $t({
                              defaultMessage: 'Edit',
                              id: 'customer_overview.billing_information_block.edit_button_label',
                              description:
                                  'The label of the button that opens the form to edit the customer billing information',
                          })
                        : $t({
                              defaultMessage: 'Add billing address',
                              id: 'customer_overview.billing_information_block.add_button_label',
                              description:
                                  'The label of the button that opens the form to add a billing address for a customer who has none yet',
                          })
                }}</Button
            >
        </template>
    </CustomerBillingInformation>
</template>
