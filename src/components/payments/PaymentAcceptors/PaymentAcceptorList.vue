<script setup lang="ts">
import { PaymentAcceptor, Section, type ContextMenuOption } from '@solvimon/solvimon-ui';
import type { PaymentAcceptor as PaymentAcceptorType } from '@solvimon/solvimon-types';

defineProps<{
    paymentAcceptors: PaymentAcceptorType[];
    /** The menu of each acceptor; left out, the rows are a summary without one. */
    getMenuItems?: (paymentAcceptor: PaymentAcceptorType) => ContextMenuOption[];
}>();
</script>

<template>
    <ul class="sv-payment-acceptor-list grid grid-cols-1 gap-1">
        <li
            v-for="paymentAcceptor in paymentAcceptors"
            :key="paymentAcceptor.id"
            class="sv-payment-acceptor-list__item"
        >
            <Section>
                <PaymentAcceptor
                    class="sv-payment-acceptor-list__item-content"
                    :payment-acceptor="paymentAcceptor"
                    :options="getMenuItems?.(paymentAcceptor)"
                />
            </Section>
        </li>
    </ul>
</template>
