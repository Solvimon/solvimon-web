<script setup lang="ts">
import {
    Section,
    Typography,
    Button,
    PaymentMethod,
    useIntl,
    triggerConditionalRequests,
} from '@solvimon/ui';
import { computed, onMounted, ref } from 'vue';
import {
    ApiStatus,
    type PaymentMethod as PaymentMethodModel,
    type PaymentMethodOptionsResponse,
} from '@solvimon/types';
import type {
    CustomerPaymentMethodsBlockEmits,
    CustomerPaymentMethodsBlockProps,
} from './CustomerPaymentMethodsBlock.types';
import type { BlockConfig } from '@/components/customer/OverViewPage.types';
import { createPaymentMethodsService } from '@/services/paymentMethods';

import ErrorState from '@/components/errorState/ErrorState.vue';
import Loader from '@/components/shared/Loader.vue';

const DEFAULT_PAYMENT_METHODS_LIMIT = 2;

const props = defineProps<CustomerPaymentMethodsBlockProps>();
const emit = defineEmits<CustomerPaymentMethodsBlockEmits>();

const { $t } = useIntl();
const { getPaymentMethods, getPaymentMethodOptions } = createPaymentMethodsService();

const paymentMethodOptions = ref<PaymentMethodOptionsResponse>();

const apiStatus = ref<ApiStatus>(ApiStatus.Initial);

const shouldFetchPaymentMethods = computed<boolean>(
    () => props.portalUrl.customer.display?.payment_acceptors ?? false,
);

const paymentMethods = ref<BlockConfig<PaymentMethodModel>>({
    show: false,
    data: [],
    showMoreLink: false,
});

const fetchPaymentMethods = (): Promise<void> =>
    getPaymentMethods({
        customerId: props.portalUrl.customer_id,
        pagination: { pageSize: DEFAULT_PAYMENT_METHODS_LIMIT, page: 1 },
    }).then((response) => {
        paymentMethods.value = {
            show: true,
            data: response.data,
            showMoreLink: !!response.links.next,
        };
    });

const fetchPaymentMethodOptions = (): Promise<void> =>
    getPaymentMethodOptions({ customerId: props.portalUrl.customer_id }).then((response) => {
        paymentMethodOptions.value = response;
    });

const runInitialRequests = async (): Promise<void> => {
    apiStatus.value = ApiStatus.Loading;
    try {
        await triggerConditionalRequests([
            {
                request: fetchPaymentMethods,
                condition: shouldFetchPaymentMethods.value,
            },
            {
                request: fetchPaymentMethodOptions,
                condition: shouldFetchPaymentMethods.value,
            },
        ]);
        apiStatus.value = ApiStatus.Done;
    } catch {
        apiStatus.value = ApiStatus.Failed;
    }
};

onMounted(runInitialRequests);

const resolvedPaymentMethods = computed<PaymentMethodModel[]>(() => paymentMethods.value.data);
const hasPaymentMethods = computed<boolean>(() => resolvedPaymentMethods.value.length > 0);

const handleViewAll = (): void => {
    emit('view-all', 'token-customer-payment-methods');
};

const handleAddPaymentMethod = (): void => {
    emit('add-payment-method', 'token-customer-payment-methods-add');
};

const handlePaymentMethodUpdated = (): void => {
    if (!shouldFetchPaymentMethods.value) {
        emit('payment-method-updated');
        return;
    }

    fetchPaymentMethods()
        .catch(() => {})
        .finally(() => {
            emit('payment-method-updated');
        });
};
</script>

<template>
    <Section
        :content-background="apiStatus !== ApiStatus.Done ? 'gray' : 'none'"
        no-spacing
        no-border
        :title="
            $t({
                defaultMessage: 'Payment methods',
                description: 'Title for the payment methods block on the customer overview page',
                id: 'customer_overview.payment_methods.title',
            })
        "
    >
        <template v-if="paymentMethods.showMoreLink" #right>
            <Button
                size="sm"
                variant="ghost"
                color="gray"
                icon-suffix="arrow_right_alt"
                type="button"
                @click="handleViewAll"
                >{{
                    $t({
                        defaultMessage: 'View all',
                        id: 'customer_overview.payment_methods_block.view_all_payment_methods_link_label',
                        description:
                            'The link text that links to the overview page of the customer invoices',
                    })
                }}</Button
            >
        </template>

        <Loader v-if="apiStatus === ApiStatus.Loading" with-spacing />

        <ErrorState
            v-else-if="apiStatus === ApiStatus.Failed"
            with-spacing
            :title="
                $t({
                    id: 'customer_overview.payment_methods_block.load_failed.title',
                    defaultMessage: 'We can’t load your payment methods',
                    description: 'Title when payments methods fail to load',
                })
            "
            :subtitle="
                $t({
                    id: 'customer_overview.payment_methods_block.load_failed.subtitle',
                    defaultMessage: 'Please refresh or contact support.',
                    description: 'Subtitle when payments methods fail to load',
                })
            "
            :show-retry="true"
            @retry="runInitialRequests"
        />

        <div v-if="apiStatus === ApiStatus.Done">
            <div v-if="hasPaymentMethods" class="flex flex-col gap-2">
                <Section v-for="paymentMethod in resolvedPaymentMethods" :key="paymentMethod.id">
                    <PaymentMethod
                        :payment-method="paymentMethod"
                        @payment-method-updated="handlePaymentMethodUpdated"
                    />
                </Section>
            </div>
            <Section v-else>
                <Typography variant="body-sm" shade="lighter" no-spacing>{{
                    $t({
                        defaultMessage: 'Add a payment method for recurring invoice payments.',
                        description:
                            'Helper text for adding a payment method when no payment methods are configured',
                        id: 'customer_overview.payment_methods_block.add_payment_method_helper_text',
                    })
                }}</Typography>
                <Button
                    class="w-full mt-4"
                    variant="outline"
                    color="gray"
                    icon-prefix="add"
                    type="button"
                    @click="handleAddPaymentMethod"
                >
                    {{
                        $t({
                            defaultMessage: 'Add payment method',
                            description:
                                'Text for the add payment method button that is shown when no payment methods have been configured',
                            id: 'customer_overview.payment_methods_block.add_payment_method_button_label',
                        })
                    }}
                </Button>
            </Section>
        </div>
    </Section>
</template>
