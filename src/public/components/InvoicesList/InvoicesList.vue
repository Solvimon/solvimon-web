<script setup lang="ts">
import { Section, useIntl } from '@solvimon/ui';
import type { InvoicesListEmits, InvoicesListProps } from './InvoicesList.types';
import InvoiceTable from '@/components/InvoiceTable/InvoiceTable.vue';
import { useActionDispatchProvider } from '@/components/providers';

withDefaults(defineProps<InvoicesListProps>(), {
    configuration: () => ({
        showPayButton: true,
        showViewButton: true,
        pagination: {
            batchSize: 15,
            enabled: true,
        },
    }),
});
defineEmits<InvoicesListEmits>();

const { $t } = useIntl();
const { dispatchAction } = useActionDispatchProvider();
</script>

<template>
    <Section
        no-border
        spacing="none"
        content-background="none"
        :title="
            $t({
                defaultMessage: 'Invoices',
                description: 'Invoices list title',
                id: 'invoices_list.title',
            })
        "
    >
        <InvoiceTable
            :configuration="configuration"
            :has-more-items="hasMoreItems"
            :invoices="invoices"
            :is-loading="isLoading"
            @load-more="$emit('load-more')"
            @view-invoice="
                dispatchAction({ action: 'view-invoice', data: { invoiceId: $event.invoiceId } })
            "
            @pay-invoice="
                dispatchAction({ action: 'pay-invoice', data: { invoiceId: $event.invoiceId } })
            "
        />
    </Section>
</template>
