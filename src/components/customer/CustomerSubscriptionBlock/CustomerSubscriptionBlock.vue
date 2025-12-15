<script setup lang="ts">
import { Section, Typography, useIntl, Button, triggerConditionalRequests } from '@solvimon/ui';
import { computed, onMounted, ref } from 'vue';
import {
    ApiStatus,
    type Customer as CustomerType,
    type PaymentMethod as PaymentMethodModel,
} from '@solvimon/types';
import type {
    CustomerSubscriptionsBlockProps,
    CustomerSubscriptionsBlockEmits,
} from './CustomerSubscriptionBlock.types';
import CustomerSubscriptionBlockItem from './CustomerSubscriptionBlockItem.vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import type { BlockConfig } from '@/components/customer/OverViewPage.types';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import { createCustomerService } from '@/services/customer';
import { createSubscriptionsService } from '@/services/subscriptions';

import ErrorState from '@/components/errorState/ErrorState.vue';
import Loader from '@/components/shared/Loader.vue';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';

const DEFAULT_SUBSCRIPTIONS_LIMIT = 3;
const DEFAULT_PAYMENT_METHODS_LIMIT = 2;

const props = defineProps<CustomerSubscriptionsBlockProps>();
const emit = defineEmits<CustomerSubscriptionsBlockEmits>();

const portal = usePortal();

if (portal.value.type !== 'CUSTOMER') {
    throw new Error('Invalid portal type');
}

const portalObject = portal.value;

const { $t } = useIntl();
const { getPaymentMethods } = createPaymentMethodsService();
const { getCustomer } = createCustomerService();
const { getActiveSubscriptions } = createSubscriptionsService();

const paymentMethods = ref<BlockConfig<PaymentMethodModel>>({
    show: false,
    data: [],
    showMoreLink: false,
});
const subscriptions = ref<BlockConfig<PricingPlanSubscriptionExpanded>>({
    show: false,
    data: [],
    showMoreLink: false,
});

const customer = ref<CustomerType>();

const apiStatus = ref<ApiStatus>(ApiStatus.Initial);

const fetchPaymentMethods = (): Promise<void> =>
    getPaymentMethods({
        customerId: portalObject.customer_id,
        pagination: { pageSize: DEFAULT_PAYMENT_METHODS_LIMIT, page: 1 },
    }).then((response) => {
        paymentMethods.value = {
            show: true,
            data: response.data,
            showMoreLink: !!response.links.next,
        };
    });

const fetchSubscriptions = (): Promise<void> =>
    getActiveSubscriptions({
        customerId: portalObject.customer_id,
        pagination: { pageSize: DEFAULT_SUBSCRIPTIONS_LIMIT, page: 1 },
    }).then((response) => {
        let data = response.data;

        if (props.subscriptionIds?.length) {
            const ids = new Set(props.subscriptionIds);
            data = data.filter((subscription) => ids.has(subscription.id));
        }

        const showMoreLink = !props.subscriptionIds?.length && !!response.links.next;

        subscriptions.value = {
            show: true,
            data,
            showMoreLink,
        };
    });

const fetchCustomer = (): Promise<void> =>
    getCustomer(portalObject.customer_id).then((response) => {
        customer.value = response;
    });

const runInitialRequests = async (): Promise<void> => {
    apiStatus.value = ApiStatus.Loading;
    try {
        await triggerConditionalRequests([
            {
                request: fetchSubscriptions,
                condition: !!portalObject.customer.display?.pricing_plan_subscriptions,
            },
            {
                request: fetchPaymentMethods,
                condition: !!portalObject.customer.display?.payment_acceptors,
            },
            { request: fetchCustomer, condition: true },
        ]);

        apiStatus.value = ApiStatus.Done;
    } catch {
        apiStatus.value = ApiStatus.Failed;
    }
};

onMounted(runInitialRequests);

const hasSubscriptions = computed<boolean>(() => subscriptions.value.data.length > 0);

const showOverviewLink = computed<boolean>(() => subscriptions.value.showMoreLink);

const shouldRenderBlock = computed<boolean>(() => subscriptions.value.show && !!customer.value);

const getPaymentMethod = (
    paymentMethodId?: PaymentMethodModel['id'],
): PaymentMethodModel | undefined => {
    if (!paymentMethodId) {
        return undefined;
    }

    return paymentMethods.value.data.find(
        ({ id, type }) => id === paymentMethodId && type === 'CARD',
    );
};

const handleViewAll = (): void => {
    emit('view-all', 'token-customer-subscriptions');
};

const handleViewDetails = (subscriptionId: string): void => {
    emit('view-details', {
        subscriptionId,
        routeName: 'token-customer-subscriptions-subscriptionId',
    });
};

const handleCancelSubscription = (subscriptionId: string): void => {
    emit('cancel-subscription', {
        subscriptionId,
        routeName: 'token-customer-subscriptions-subscriptionId-cancel',
    });
};

const handleRenewSubscription = (subscriptionId: string): void => {
    emit('renew-subscription', {
        subscriptionId,
        routeName: 'token-customer-subscriptions-subscriptionId-renew',
    });
};
</script>

<template>
    <Section
        no-spacing
        no-border
        :title="
            $t({
                defaultMessage: 'My subscriptions',
                description: 'Title for the subscriptions block on the customer overview page',
                id: 'customer_overview.subscriptions_block.title',
            })
        "
    >
        <template v-if="showOverviewLink" #right>
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
                        description: 'The text for the view all subscriptions button',
                        id: 'customer_overview.subscriptions_block.view_all_button_label',
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
                    id: 'customer_overview.subscriptions_block.load_failed.title',
                    defaultMessage: 'We can’t load your subscriptions',
                    description: 'Title when subscriptions fail to load',
                })
            "
            :subtitle="
                $t({
                    id: 'customer_overview.subscriptions_block.load_failed.subtitle',
                    defaultMessage: 'Please refresh or contact support.',
                    description: 'Subtitle when subscriptions fail to load',
                })
            "
            :show-retry="true"
            @retry="runInitialRequests"
        />

        <div v-if="apiStatus === ApiStatus.Done && shouldRenderBlock">
            <Section v-if="!hasSubscriptions">
                <Typography tag="h3" variant="heading-3">
                    {{
                        $t({
                            defaultMessage: 'No subscriptions',
                            description:
                                'Title for the my subscriptions block on the customer overview page',
                            id: 'customer_overview.subscriptions_block.no_active_subscription_title',
                        })
                    }}</Typography
                >
                <Typography variant="body-xs" shade="lighter">
                    {{
                        $t({
                            defaultMessage: 'There’s no active subscription to display.',
                            description:
                                'Text that is being displayed when there is no active subscription in the subscriptions block',
                            id: 'customer_overview.subscriptions_block.no_active_subscription_content',
                        })
                    }}</Typography
                >
            </Section>
            <CustomerSubscriptionBlockItem
                v-for="(subscription, index) in subscriptions.data"
                v-else
                :key="subscription.id"
                :is-first="index === 0"
                :class="{ 'mt-4': index > 0 }"
                :subscription="subscription"
                :payment-method="getPaymentMethod(subscription.payment_method_id)"
                :hide-cta-buttons="hideCtaButtons"
                :customer="customer!"
                @view-details="handleViewDetails"
                @cancel-subscription="handleCancelSubscription"
                @renew-subscription="handleRenewSubscription"
            />
        </div>
    </Section>
</template>
