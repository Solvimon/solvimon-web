<script setup lang="ts">
import { Button, CustomerBillingInformation, useIntl, Section } from '@solvimon/ui';
import { computed, ref, watch } from 'vue';
import { ApiStatus, type Customer } from '@solvimon/types';
import type { CustomerBillingInformationBlockEmits } from './CustomerBillingInformationBlock.types';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';
import { createCustomerService } from '@/services/customer';

import ErrorState from '@/components/errorState/ErrorState.vue';
import Loader from '@/components/shared/Loader.vue';

const emit = defineEmits<CustomerBillingInformationBlockEmits>();

const portal = usePortal();
const { getCustomer } = createCustomerService();
const { $t } = useIntl();

const apiStatus = ref<ApiStatus>(ApiStatus.Initial);

const customerId = computed<string | undefined>(() => portal.value?.customer_id);

const billingInformation = ref<{ show: boolean; data?: Customer }>({
    show: false,
    data: undefined,
});

const fetchCustomer = async (id: Customer['id']): Promise<void> => {
    apiStatus.value = ApiStatus.Loading;
    try {
        const response = await getCustomer(id);
        billingInformation.value = { show: true, data: response };
        apiStatus.value = ApiStatus.Done;
    } catch (_error) {
        apiStatus.value = ApiStatus.Failed;
    }
};

watch(
    customerId,
    (id) => {
        if (!id) {
            return;
        }

        fetchCustomer(id).catch(() => {});
    },
    { immediate: true },
);

const handleEdit = (): void => {
    emit('edit-billing-information', 'token-customer-billing-information');
};
</script>

<template>
    <Section
        no-spacing
        no-border
        :content-background="apiStatus !== ApiStatus.Done ? 'gray' : 'none'"
        :title="
            apiStatus !== ApiStatus.Done
                ? $t({
                      defaultMessage: 'Billing information',
                      description:
                          'Title for the billing information block on the customer overview page',
                      id: 'customer_overview.billing_information_block.title',
                  })
                : undefined
        "
    >
        <Loader v-if="apiStatus === ApiStatus.Loading" with-spacing />

        <ErrorState
            v-else-if="apiStatus === ApiStatus.Failed"
            with-spacing
            :title="
                $t({
                    id: 'customer_overview.billing_information_block.load_failed.title',
                    defaultMessage: 'We can’t load your billing information',
                    description: 'Title when payments methods fail to load',
                })
            "
            :subtitle="
                $t({
                    id: 'customer_overview.billing_information_block.load_failed.subtitle',
                    defaultMessage: 'Please refresh or contact support.',
                    description: 'Subtitle when payments methods fail to load',
                })
            "
            :show-retry="true"
            @retry="fetchCustomer(String(customerId))"
        />

        <div v-if="apiStatus === ApiStatus.Done">
            <CustomerBillingInformation
                v-if="billingInformation.show"
                :customer="billingInformation.data"
            >
                <template #settings>
                    <Button
                        size="sm"
                        variant="ghost"
                        color="gray"
                        icon-prefix="edit"
                        @click="handleEdit"
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
        </div>
    </Section>
</template>
