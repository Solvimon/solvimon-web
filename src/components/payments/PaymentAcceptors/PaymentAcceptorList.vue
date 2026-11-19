<script setup lang="ts">
import { PaymentAcceptor, Section, type ContextMenuOption } from '@solvimon/solvimon-ui';
import type { PaymentAcceptor as PaymentAcceptorType } from '@solvimon/solvimon-types';
import LimitedList from '@/components/shared/LimitedList/LimitedList.vue';

defineProps<{
    paymentAcceptors: PaymentAcceptorType[];
    /** How many to show; the rest are counted below them. Left out, all show. */
    limit?: number;
    /** The menu of each acceptor; left out, the rows are a summary without one. */
    getMenuItems?: (paymentAcceptor: PaymentAcceptorType) => ContextMenuOption[];
}>();
</script>

<template>
    <LimitedList
        class="sv-payment-acceptor-list"
        :items="paymentAcceptors"
        :limit="limit"
        :item-key="({ id }) => id"
        item-class="sv-payment-acceptor-list__item"
        more-class="sv-payment-acceptor-list__more"
    >
        <template #item="{ item }">
            <Section>
                <PaymentAcceptor
                    class="sv-payment-acceptor-list__item-content"
                    :payment-acceptor="item"
                    :options="getMenuItems?.(item)"
                />
            </Section>
        </template>
    </LimitedList>
</template>
