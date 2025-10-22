<script setup lang="ts">
import { Section, Typography, Button, useIntl, triggerConditionalRequests } from '@solvimon/ui';
import { computed, onMounted, ref } from 'vue';
import { ApiStatus, type Invoice } from '@solvimon/types';
import type {
    CustomerInvoicesBlockProps,
    CustomerInvoicesBlockEmits,
} from './CustomerInvoicesBlock.types';
import InvoiceTable from '@/components/InvoiceTable/InvoiceTable.vue';
import type { BlockConfig } from '@/components/customer/OverViewPage.types';
import { createInvoicesService } from '@/services/invoices';
import ErrorState from '@/components/errorState/ErrorState.vue';
import Loader from '@/components/shared/Loader.vue';

const props = defineProps<CustomerInvoicesBlockProps>();
const emit = defineEmits<CustomerInvoicesBlockEmits>();
const { $t } = useIntl();
const { getInvoices } = createInvoicesService();

const apiStatus = ref<ApiStatus>(ApiStatus.Initial);

const PAYMENT_INVOICES_LIMIT = 10;

const invoices = ref<BlockConfig<Invoice>>({
    show: false,
    data: [],
    showMoreLink: false,
});

const shouldFetchInvoices = computed<boolean>(
    () => props.portalUrl.customer.display?.invoices ?? false
);

const fetchInvoices = (): Promise<void> =>
    getInvoices({
        customerId: props.portalUrl.customer_id,
        pagination: { pageSize: PAYMENT_INVOICES_LIMIT, page: 1 },
    }).then((response) => {
        invoices.value = {
            show: true,
            data: response.data,
            showMoreLink: !!response.links.next,
        };
    });

const runInitialRequests = async (): Promise<void> => {
    apiStatus.value = ApiStatus.Loading;
    try {
        await triggerConditionalRequests([
            {
                request: fetchInvoices,
                condition: shouldFetchInvoices.value,
            },
        ]);
        apiStatus.value = ApiStatus.Done;
    } catch {
        apiStatus.value = ApiStatus.Failed;
    }
};

onMounted(runInitialRequests);

const resolvedInvoices = computed<Invoice[]>(() => invoices.value.data);
const hasInvoices = computed<boolean>(() => resolvedInvoices.value.length > 0);
const shouldRenderBlock = computed<boolean>(() => invoices.value.show);

const resolvedShowOverviewLink = computed<boolean>(() => {
    if (props.showOverviewLink !== undefined) {
        return props.showOverviewLink;
    }

    return invoices.value.showMoreLink;
});

const handleViewAll = (): void => {
    emit('view-all', 'token-customer-invoices');
};

const handleViewInvoice = (invoiceId: Invoice['id']): void => {
    emit('view-invoice', {
        invoiceId,
        routeName: 'token-customer-invoices-invoiceId',
    });
};

const handlePayInvoice = (invoiceId: Invoice['id']): void => {
    emit('pay-invoice', {
        invoiceId,
        routeName: 'token-customer-invoices-invoiceId-pay',
    });
};
</script>

<template>
    <Section
        no-spacing
        no-border
        :title="
            $t({
                defaultMessage: 'Invoices',
                description: 'Title for the invoices block on the customer overview page',
                id: 'customer_overview.invoices_block.title',
            })
        "
    >
        <template v-if="resolvedShowOverviewLink && hasInvoices" #right>
            <Button
                size="sm"
                variant="ghost"
                color="gray"
                icon-suffix="arrow_right_alt"
                @click="handleViewAll"
            >
                {{
                    $t({
                        defaultMessage: 'View all',
                        id: 'customer_overview.invoices_block.view_all_invoices_link_label',
                        description: 'Link to the customer invoices overview page',
                    })
                }}
            </Button>
        </template>

        <Loader v-if="apiStatus === ApiStatus.Loading" with-spacing />

        <ErrorState
            v-else-if="apiStatus === ApiStatus.Failed"
            with-spacing
            :title="
                $t({
                    id: 'customer_invoices.load_failed.title',
                    defaultMessage: 'We can’t load your invoices',
                    description: 'Title when invoices fail to load',
                })
            "
            :subtitle="
                $t({
                    id: 'customer_invoices.load_failed.subtitle',
                    defaultMessage: 'Please refresh or contact support.',
                    description: 'Subtitle when invoices fail to load',
                })
            "
            :show-retry="true"
            @retry="runInitialRequests"
        />

        <div v-if="apiStatus === ApiStatus.Done && shouldRenderBlock">
            <div v-if="hasInvoices">
                <InvoiceTable
                    :invoices="resolvedInvoices"
                    @view-invoice="handleViewInvoice"
                    @pay-invoice="handlePayInvoice"
                />
            </div>

            <div v-else class="pt-6">
                <Typography tag="h3" variant="heading-2" center>
                    {{
                        $t({
                            defaultMessage: 'No invoices to display',
                            description:
                                'Shown when there are no invoices to display in the invoices block',
                            id: 'customer_overview.invoices_block.no_invoices_title',
                        })
                    }}
                </Typography>
                <Typography variant="body-xs" shade="lighter" center>
                    {{
                        $t({
                            defaultMessage:
                                'You haven’t received an invoice yet. It’ll appear here once it’s generated.',
                            description:
                                'Body text when there are no invoices to display in the invoices block',
                            id: 'customer_overview.invoices_block.no_active_subscription_content',
                        })
                    }}
                </Typography>
                <img src="@/assets/images/invoice.svg" class="mx-auto mt-6 -mb-3 max-w-[480px]" />
            </div>
        </div>
    </Section>
</template>
