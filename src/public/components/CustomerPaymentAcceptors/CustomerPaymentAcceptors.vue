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
import type { PaymentAcceptorsModalStart } from '@/components/payments/PaymentAcceptors/PaymentAcceptorsModal.types';
import Skeleton from '@/components/shared/Skeleton.vue';
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
const modalStart = ref<PaymentAcceptorsModalStart>({ step: 'LIST' });

const openModal = (start: PaymentAcceptorsModalStart) => {
    modalStart.value = start;
    hasOpenedModal.value = true;
    isModalShown.value = true;
};

/** Managing a subscription's acceptors chooses them; the customer's own, lists them. */
const manage = () => openModal({ step: props.subscription ? 'CHOOSE' : 'LIST' });
const add = () => openModal({ step: props.subscription ? 'CHOOSE' : 'ADD' });

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
                <Button
                    size="xs"
                    intent="subtle"
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

            <template v-else-if="shownAcceptors.length">
                <PaymentAcceptorList
                    class="sv-payment-acceptors__list"
                    :payment-acceptors="shownAcceptors"
                />
                <Typography
                    v-if="hiddenCount > 0"
                    variant="body-xs"
                    color="secondary"
                    tag="p"
                    no-spacing
                    class="sv-payment-acceptors__more"
                    >{{
                        $t(
                            {
                                defaultMessage: '+ {count} more',
                                id: 'customer_overview.payment_acceptors_block.more',
                                description:
                                    'Counts the bank accounts the payment acceptors block leaves out',
                            },
                            { count: String(hiddenCount) },
                        )
                    }}</Typography
                >
            </template>

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
            v-if="hasOpenedModal"
            :show-modal="isModalShown"
            :start="modalStart"
            :payment-acceptors="items"
            :is-loading="isPending"
            :actions="paymentAcceptors"
            :subscription="
                subscription
                    ? {
                          id: subscription.id,
                          paymentAcceptorIds: linkedIds,
                          payerName,
                      }
                    : undefined
            "
            :save-choice="saveChoice"
            @close="isModalShown = false"
        />
    </Section>
</template>
