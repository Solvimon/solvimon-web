<script setup lang="ts">
import { Section, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { InvoicesListEmits, InvoicesListProps } from './InvoicesList.types';
import InvoiceTable from '@/components/InvoiceTable/InvoiceTable.vue';
import { useActionDispatchProvider } from '@/components/providers';
import { resolveConfiguration } from '@/utils/configuration';

/** Only the options this component reads — the batch size is resolved where the invoices are fetched. */
const DEFAULT_CONFIGURATION = {
    showPayButton: true,
    showViewButton: true,
    pagination: {
        enabled: true,
    },
};

const props = defineProps<InvoicesListProps>();
defineEmits<InvoicesListEmits>();

const configuration = computed(() =>
    resolveConfiguration(DEFAULT_CONFIGURATION, props.configuration),
);

const { $t } = useIntl();
const { dispatchAction } = useActionDispatchProvider();
</script>

<template>
    <Section
        class="sv-invoices-list sv-root sv-component"
        no-border
        no-spacing
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
            class="sv-invoices-list__table"
            :configuration="configuration"
            :has-more-items="configuration.pagination.enabled && hasMoreItems"
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
