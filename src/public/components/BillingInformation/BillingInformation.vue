<script setup lang="ts">
import { Button, CustomerBillingInformation, useIntl } from '@solvimon/solvimon-ui';
import Skeleton from '@/components/shared/Skeleton.vue';
import type { BillingInformationEmits, BillingInformationProps } from './BillingInformation.types';
import { useActionDispatchProvider } from '@/components/providers';

withDefaults(defineProps<BillingInformationProps>(), {
    configuration: () => ({
        showEditButton: true,
    }),
});
defineEmits<BillingInformationEmits>();

const { $t } = useIntl();
const { dispatchAction } = useActionDispatchProvider();
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="min-h-[100px]"
        data-testid="billing-information-skeleton"
    />
    <CustomerBillingInformation v-else :customer="customer" :fallback-to-reference="false">
        <template v-if="configuration.showEditButton" #settings>
            <Button
                size="sm"
                variant="ghost"
                color="gray"
                icon-prefix="edit"
                @click="dispatchAction({ action: 'edit-billing-information' })"
                >{{
                    $t({
                        defaultMessage: 'Edit',
                        id: 'customer_overview.billing_information_block.view_all_payment_methods_link_label',
                        description:
                            'The link text that links to the overview page of the customer billing information',
                    })
                }}</Button
            >
        </template>
    </CustomerBillingInformation>
</template>
