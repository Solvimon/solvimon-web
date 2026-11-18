<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { Button, ErrorNotification, Section, Typography, useIntl } from '@solvimon/solvimon-ui';
import type {
    CustomerPaymentAcceptorsEmits,
    CustomerPaymentAcceptorsProps,
} from './CustomerPaymentAcceptors.types';
import { DEFAULT_MAX_ITEMS, getSubscriptionPaymentAcceptors } from './CustomerPaymentAcceptors.lib';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import PaymentAcceptorList from '@/components/payments/PaymentAcceptors/PaymentAcceptorList.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useActionDispatchProvider } from '@/components/providers';
import { usePaymentAcceptors } from '@/composables/usePaymentAcceptors';
import { createSubscriptionsService } from '@/services/subscriptions';

/** Most customers never open it, so it is not part of the screen until one does. */
const PaymentAcceptorsModal = defineAsyncComponent(
    () => import('@/components/payments/PaymentAcceptors/PaymentAcceptorsModal.vue'),
);

const props = defineProps<CustomerPaymentAcceptorsProps>();
const emit = defineEmits<CustomerPaymentAcceptorsEmits>();

const { $t } = useIntl();

const customerId = computed(() => props.customerId ?? props.subscription?.customer_id);

const paymentAcceptors = usePaymentAcceptors({ customerId });
const { items, isPending, error } = paymentAcceptors;

watch(
    customerId,
    (customerId) => {
        if (customerId) void paymentAcceptors.fetchAll();
    },
    { immediate: true },
);

/** The acceptors linked to the subscription; none means every active one applies. */
const linkedIds = computed(
    () =>
        props.subscription?.payment_acceptor_ids ??
        props.subscription?.payment_acceptors?.map(({ id }) => id) ??
        [],
);

const hasNoneChosen = computed(() => !!props.subscription && linkedIds.value.length === 0);

/** Who pays the subscription: the billing entity it bills the customer's self-billing for. */
const payerName = computed(() => props.subscription?.billing_entity?.legal_name);

const relevantAcceptors = computed(() =>
    props.subscription
        ? getSubscriptionPaymentAcceptors(items.value, linkedIds.value)
        : items.value,
);

const maxItems = computed(() => props.maxItems ?? DEFAULT_MAX_ITEMS);
const shownAcceptors = computed(() => relevantAcceptors.value.slice(0, maxItems.value));
const hiddenCount = computed(() => relevantAcceptors.value.length - shownAcceptors.value.length);

const subscriptionsService = createSubscriptionsService();

const saveChoice = async (paymentAcceptorIds: string[]) => {
    if (!props.subscription) return;

    await subscriptionsService.setSubscriptionPaymentAcceptors({
        id: props.subscription.id,
        paymentAcceptorIds,
    });
    emit('subscription-changed');
};

const hasOpenedModal = ref(false);
const isModalShown = ref(false);
const openModal = () => {
    hasOpenedModal.value = true;
    isModalShown.value = true;
};

const { dispatchAction } = useActionDispatchProvider();

/**
 * A subscription's acceptors are chosen in place. The customer's own are listed and added on screens
 * the host routes to.
 */
const manage = () =>
    props.subscription ? openModal() : dispatchAction({ action: 'view-all-payment-acceptors' });
const add = () =>
    props.subscription ? openModal() : dispatchAction({ action: 'add-payment-acceptor' });

const description = computed(() => {
    if (!props.subscription) {
        return $t({
            defaultMessage:
                'Bank accounts where you receive payments for your self-billing subscriptions.',
            id: 'customer_overview.payment_acceptors_block.description',
            description:
                'Explains the payment acceptors block on the customer overview: the bank accounts the customer is paid into',
        });
    }

    const payer =
        payerName.value ||
        $t({
            defaultMessage: 'Your customer',
            id: 'subscription_details.payment_acceptors_block.payer_fallback',
            description:
                'Stands in for the name of whoever pays the subscription when it is not known',
        });

    return hasNoneChosen.value
        ? $t(
              {
                  defaultMessage:
                      'No specific accounts are chosen for this subscription, so {payer} can pay you into any of your active accounts.',
                  id: 'subscription_details.payment_acceptors_block.none_chosen',
                  description:
                      'Explains on a subscription without chosen bank accounts that every active one of the customer applies',
              },
              { payer },
          )
        : $t(
              {
                  defaultMessage: '{payer} pays you into these accounts for this subscription.',
                  id: 'subscription_details.payment_acceptors_block.description',
                  description:
                      'Explains the bank accounts a self-billing subscription is paid into',
              },
              { payer },
          );
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
            <slot name="action" :manage="manage">
                <button
                    v-if="subscription"
                    type="button"
                    class="sv-action sv-action--link sv-payment-acceptors__manage rounded text-xs font-semibold text-primary-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
                    @click="manage"
                >
                    {{
                        $t({
                            defaultMessage: 'Manage',
                            id: 'customer_overview.payment_acceptors_block.manage_button_label',
                            description:
                                'Label of the button that opens the modal to manage the bank accounts the customer is paid into',
                        })
                    }}
                </button>
                <Button
                    v-else-if="items.length"
                    size="xs"
                    intent="subtle"
                    icon-suffix="arrow_right_alt"
                    class="sv-action sv-action--ghost sv-payment-acceptors__view-all"
                    @click="manage"
                    >{{
                        $t({
                            defaultMessage: 'View all',
                            id: 'customer_overview.payment_acceptors_block.view_all_button_label',
                            description:
                                'Label of the button that opens the list of all the bank accounts the customer is paid into',
                        })
                    }}</Button
                >
            </slot>
        </template>

        <div class="grid grid-cols-1 gap-2">
            <Typography
                variant="body-xs"
                color="secondary"
                tag="p"
                no-spacing
                class="sv-payment-acceptors__description"
                >{{ description }}</Typography
            >

            <ErrorNotification
                v-if="error"
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

            <Skeleton
                v-else-if="isPending && !items.length"
                variant="section"
                class="min-h-[100px]"
            />

            <div v-else-if="shownAcceptors.length" class="grid grid-cols-1 gap-1">
                <PaymentAcceptorList
                    class="sv-payment-acceptors__list"
                    :payment-acceptors="shownAcceptors"
                />
                <Section
                    v-if="hiddenCount > 0"
                    no-spacing
                    content-classes="px-4 py-3 text-center"
                    class="sv-payment-acceptors__more"
                >
                    <Typography tag="span" weight="semibold" color="secondary" no-spacing>{{
                        $t(
                            {
                                defaultMessage: '+ {count} more',
                                id: 'customer_overview.payment_acceptors_block.more',
                                description:
                                    'Counts the bank accounts the payment acceptors block leaves out',
                            },
                            { count: String(hiddenCount) },
                        )
                    }}</Typography>
                </Section>
            </div>

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
                <template #message>
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
            v-if="hasOpenedModal && subscription"
            :show-modal="isModalShown"
            :payment-acceptors="items"
            :create="paymentAcceptors.create"
            :subscription="{ id: subscription.id, paymentAcceptorIds: linkedIds, payerName }"
            :save-choice="saveChoice"
            @close="isModalShown = false"
        />
    </Section>
</template>
