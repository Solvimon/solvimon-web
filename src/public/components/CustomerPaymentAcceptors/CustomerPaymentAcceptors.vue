<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import {
    Button,
    ErrorNotification,
    PaymentAcceptor,
    Section,
    useIntl,
} from '@solvimon/solvimon-ui';
import type { CustomerPaymentAcceptorsProps } from './CustomerPaymentAcceptors.types';
import {
    DEFAULT_MAX_ITEMS,
    getSubscriptionPaymentAcceptors,
    toPaymentAcceptorAssignment,
} from './CustomerPaymentAcceptors.lib';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import LimitedList from '@/components/shared/LimitedList/LimitedList.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import { usePaymentAcceptors } from '@/composables/usePaymentAcceptors';
import { createSubscriptionsService } from '@/services/subscriptions';
import { useHostEvent } from '@/components/providers/HostElementProvider/composables/useHostEvent';
import type { PaymentAcceptorAssignment } from '@/public/types/paymentAcceptors';

/** Most customers never open it, so it is not part of the screen until one does. */
const PaymentAcceptorsModal = defineAsyncComponent(
    () =>
        import('@/public/components/CustomerPaymentAcceptors/internal/PaymentAcceptors/PaymentAcceptorsModal.vue'),
);
const PaymentAcceptorsManageModal = defineAsyncComponent(
    () =>
        import('@/public/components/CustomerPaymentAcceptors/internal/PaymentAcceptors/PaymentAcceptorsManageModal.vue'),
);

const props = defineProps<CustomerPaymentAcceptorsProps>();

const { $t } = useIntl();
const { dispatch, componentName } = useHostEvent();

const customerId = computed(() => props.customerId ?? props.subscription?.customer_id);

const paymentAcceptors = usePaymentAcceptors({
    customerId,
    onChanged: (detail) =>
        dispatch('solvimon-payment-acceptor-changed', { componentName, ...detail }),
});
const { items, isPending, error } = paymentAcceptors;

watch(customerId, () => void paymentAcceptors.fetchAll(), { immediate: true });

const savedChoice = ref<{ subscriptionId: string; assignment: PaymentAcceptorAssignment }>();

/** The acceptors linked to the subscription; none means every active one applies. */
const assignment = computed(() => {
    if (savedChoice.value && savedChoice.value.subscriptionId === props.subscription?.id) {
        return savedChoice.value.assignment;
    }
    return toPaymentAcceptorAssignment(
        props.subscription?.payment_acceptor_ids ??
            props.subscription?.payment_acceptors?.map(({ id }) => id) ??
            [],
    );
});

/** Who pays the subscription: the billing entity it bills the customer's self-billing for. */
const payerName = computed(() => props.subscription?.billing_entity?.legal_name);

const relevantAcceptors = computed(() =>
    props.subscription
        ? getSubscriptionPaymentAcceptors(items.value, assignment.value)
        : items.value,
);

const maxItems = computed(() =>
    typeof props.maxItems === 'number' && Number.isFinite(props.maxItems)
        ? Math.max(1, Math.floor(props.maxItems))
        : DEFAULT_MAX_ITEMS,
);

const subscriptionsService = createSubscriptionsService();

const saveChoice = async (selection: PaymentAcceptorAssignment) => {
    if (!props.subscription) return;

    const subscriptionId = props.subscription.id;
    const paymentAcceptorIds =
        selection.mode === 'selected' ? [...selection.paymentAcceptorIds] : [];
    const saved = await subscriptionsService.setSubscriptionPaymentAcceptors({
        id: subscriptionId,
        paymentAcceptorIds,
    });
    const assignment =
        saved.payment_acceptor_ids === undefined
            ? selection
            : toPaymentAcceptorAssignment(saved.payment_acceptor_ids ?? []);
    if (props.subscription?.id === subscriptionId)
        savedChoice.value = { subscriptionId, assignment };
    dispatch('solvimon-subscription-payment-acceptors-changed', {
        componentName,
        subscriptionId,
        assignment,
    });
};

const hasOpenedModal = ref(false);
const isModalShown = ref(false);
const openModal = () => {
    hasOpenedModal.value = true;
    isModalShown.value = true;
};

const hasOpenedManageModal = ref(false);
const isManageModalShown = ref(false);
const manageModalStart = ref<'LIST' | 'ADD'>('LIST');
const openManageModal = (start: 'LIST' | 'ADD') => {
    manageModalStart.value = start;
    hasOpenedManageModal.value = true;
    isManageModalShown.value = true;
};

/** A subscription's acceptors are chosen for it; the customer's own are managed in a modal. */
const manage = () => (props.subscription ? openModal() : openManageModal('LIST'));
const add = () => (props.subscription ? openModal() : openManageModal('ADD'));

const canManage = computed(
    () => props.management !== 'read-only' && !isPending.value && !error.value,
);
const hasManageButton = computed(
    () =>
        canManage.value &&
        (relevantAcceptors.value.length > 0 ||
            (props.subscription && assignment.value.mode === 'selected')),
);

watch(canManage, (canManage) => {
    if (!canManage && props.management === 'read-only') {
        isModalShown.value = false;
        isManageModalShown.value = false;
    }
});

const description = computed(() => {
    if (!props.subscription) {
        return $t({
            defaultMessage: 'Where you receive payments for your self-billing subscriptions.',
            id: 'customer_overview.payment_acceptors_block.where_paid',
            description:
                'Explains the payment acceptors block on the customer overview and the payment acceptors screen: where the customer is paid',
        });
    }

    return $t({
        defaultMessage: 'Where you receive payments for this subscription.',
        id: 'subscription_details.payment_acceptors_block.where_paid',
        description:
            'Explains the payment acceptors block on a self-billing subscription: where the customer is paid for it',
    });
});
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="sv-payment-acceptors sv-root sv-component sv-loading min-h-[100px]"
    />
    <Section
        v-else
        class="sv-payment-acceptors sv-root sv-component"
        no-spacing
        no-border
        content-background="none"
        :description="{ content: description, classes: 'sv-payment-acceptors__description' }"
        :title="
            $t(
                {
                    defaultMessage:
                        '{count, plural, one {Payment acceptor} other {Payment acceptors}}',
                    id: 'customer_overview.payment_acceptors_block.title',
                    description:
                        'Title of the block that lists the bank accounts the customer receives payments on',
                },
                { count: String(relevantAcceptors.length) },
            )
        "
    >
        <template #right>
            <Button
                v-if="hasManageButton"
                size="xs"
                intent="subtle"
                type="button"
                class="sv-action sv-action--ghost sv-payment-acceptors__manage"
                @click="manage"
                >{{
                    $t({
                        defaultMessage: 'Manage',
                        id: 'customer_overview.payment_acceptors_block.manage_button_label',
                        description:
                            'Label of the button that opens the modal to manage the bank accounts the customer is paid into',
                    })
                }}</Button
            >
        </template>

        <div class="grid grid-cols-1 gap-2">
            <template v-if="error">
                <ErrorNotification
                    class="sv-payment-acceptors__error sv-error"
                    :title="
                        $t({
                            defaultMessage: 'We could not load your payment acceptors.',
                            id: 'customer_overview.payment_acceptors_block.load_error',
                            description:
                                'Shown in the payment acceptors block when the bank accounts cannot be loaded',
                        })
                    "
                />
                <Button
                    size="xs"
                    intent="secondary"
                    :disabled="isPending"
                    class="sv-payment-acceptors__retry"
                    @click="paymentAcceptors.fetchAll()"
                >
                    {{
                        $t({
                            id: 'payment_acceptors.retry',
                            defaultMessage: 'Try again',
                            description: 'Retries loading the customer’s payment acceptors',
                        })
                    }}
                </Button>
            </template>

            <Skeleton
                v-else-if="isPending && !items.length"
                variant="section"
                class="min-h-[100px]"
            />

            <LimitedList
                v-else-if="relevantAcceptors.length"
                class="sv-payment-acceptors__list sv-payment-acceptor-list"
                :items="relevantAcceptors"
                :limit="maxItems"
                :item-key="({ id }) => id"
                item-class="sv-payment-acceptor-list__item"
                more-class="sv-payment-acceptor-list__more"
            >
                <template #item="{ item }">
                    <Section>
                        <PaymentAcceptor
                            class="sv-payment-acceptor-list__item-content"
                            :payment-acceptor="item"
                        />
                    </Section>
                </template>
            </LimitedList>

            <EmptyStatePlaceholder v-else class="sv-payment-acceptors__empty" icon="checkbook">
                <template #title>
                    {{
                        $t({
                            defaultMessage: 'No payment acceptors yet',
                            id: 'customer_overview.payment_acceptors_block.empty',
                            description:
                                'Shown in the payment acceptors block when the customer has no bank accounts',
                        })
                    }}
                </template>
                <template v-if="canManage && !hasManageButton" #message>
                    <button
                        type="button"
                        class="sv-action sv-action--link sv-payment-acceptors__add underline"
                        @click="add"
                    >
                        {{
                            $t({
                                defaultMessage: 'Add payment acceptor',
                                id: 'customer_overview.payment_acceptors_block.add_button_label',
                                description:
                                    'Label of the link that opens the form for a first bank account',
                            })
                        }}
                    </button>
                </template>
            </EmptyStatePlaceholder>
        </div>

        <PaymentAcceptorsModal
            v-if="hasOpenedModal && subscription && management !== 'read-only'"
            :show-modal="isModalShown"
            :payment-acceptors="items"
            :create="paymentAcceptors.create"
            :subscription="{ id: subscription.id, assignment, payerName }"
            :save-choice="saveChoice"
            @close="isModalShown = false"
        />

        <PaymentAcceptorsManageModal
            v-if="hasOpenedManageModal && management !== 'read-only'"
            :show-modal="isManageModalShown"
            :start="manageModalStart"
            :payment-acceptors="items"
            :actions="paymentAcceptors"
            @close="isManageModalShown = false"
        />
    </Section>
</template>
