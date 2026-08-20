<script setup lang="ts">
import { computed } from 'vue';
import {
    Button,
    Section,
    Typography,
    formatAmount,
    formatBillingPeriod,
    useIntl,
} from '@solvimon/solvimon-ui';
import type {
    EnabledPricingsListItemEmits,
    EnabledPricingsListItemProps,
} from './EnabledPricingsListItem.types';

const props = defineProps<EnabledPricingsListItemProps>();
defineEmits<EnabledPricingsListItemEmits>();

const { $t } = useIntl();

/** Left out entirely when the pricing has no flat amount — a partial price is worse than none. */
const price = computed<string | undefined>(() => {
    const { amount, billingPeriod } = props.entry;

    if (!amount) {
        return undefined;
    }

    if (!billingPeriod) {
        return formatAmount(amount);
    }

    return $t(
        {
            defaultMessage: '{amount} per {period}',
            id: 'enabled_pricings_list.item.price',
            description: 'The recurring price of an enabled pricing, e.g. "€ 100,00 per month"',
        },
        {
            amount: formatAmount(amount),
            period: formatBillingPeriod(billingPeriod, {
                short: true,
                hideValueForExactPeriods: true,
            }),
        },
    );
});
</script>

<template>
    <Section class="sv-enabled-pricings-list__item">
        <div class="sv-enabled-pricings-list__item-body flex items-center gap-4">
            <div class="sv-enabled-pricings-list__item-content grow">
                <Typography
                    tag="span"
                    variant="body-xs"
                    shade="lighter"
                    class="sv-enabled-pricings-list__item-group"
                    >{{ entry.groupName }}</Typography
                >
                <Typography
                    tag="h3"
                    variant="heading-3"
                    no-spacing
                    class="sv-enabled-pricings-list__item-name"
                    >{{ entry.name }}</Typography
                >
                <Typography
                    v-if="price"
                    tag="span"
                    variant="body-sm"
                    shade="lighter"
                    class="sv-enabled-pricings-list__item-price"
                    >{{ price }}</Typography
                >
            </div>

            <Button
                variant="outline"
                color="gray"
                class="sv-action sv-action--secondary sv-enabled-pricings-list__item-upgrade shrink-0"
                type="button"
                size="xs"
                @click="$emit('upgrade', entry)"
            >
                {{
                    $t({
                        defaultMessage: 'Upgrade',
                        id: 'enabled_pricings_list.item.upgrade_button.label',
                        description:
                            'Label for the button that changes which pricing is enabled for a group',
                    })
                }}
            </Button>
        </div>
    </Section>
</template>
