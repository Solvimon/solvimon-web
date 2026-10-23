<script setup lang="ts">
import { computed } from 'vue';
import { Chip, ContextMenu, Typography, getAddressLines, useIntl } from '@solvimon/solvimon-ui';
import type { ShippingAddressCardProps } from './ShippingAddressCard.types';

const props = defineProps<ShippingAddressCardProps>();

const { $t } = useIntl();

/** Who the parcel is for: the person, or the organization with whoever it is marked for. */
const recipientName = computed(() => {
    const { individual, organization } = props.address.recipient;

    if (organization) {
        return [organization.company_name, organization.attention_name].filter(Boolean).join(', ');
    }

    return [individual?.name?.first_name, individual?.name?.last_name].filter(Boolean).join(' ');
});

const addressLines = computed(() => getAddressLines(props.address.address));
</script>

<template>
    <div class="sv-shipping-address flex items-start gap-2">
        <div class="sv-shipping-address__content grid grow grid-cols-1 gap-0.5">
            <div class="flex items-center gap-2">
                <Typography
                    v-if="recipientName"
                    tag="span"
                    variant="body-sm"
                    weight="semibold"
                    class="sv-shipping-address__recipient"
                    >{{ recipientName }}</Typography
                >
                <Chip
                    v-if="showDefault && address.is_default"
                    class="sv-shipping-address__default"
                    size="sm"
                    :content="
                        $t({
                            defaultMessage: 'Default',
                            id: 'shipping_address.default_chip.label',
                            description: 'Marks the shipping address the customer uses by default',
                        })
                    "
                />
            </div>
            <Typography
                v-for="(line, index) in addressLines"
                :key="index"
                tag="span"
                variant="body-sm"
                color="secondary"
                class="sv-shipping-address__line"
                >{{ line }}</Typography
            >
            <Typography
                v-if="address.recipient.phone_number"
                tag="span"
                variant="body-sm"
                color="secondary"
                class="sv-shipping-address__phone"
                >{{ address.recipient.phone_number }}</Typography
            >
        </div>

        <ContextMenu
            v-if="menuItems?.length"
            class="sv-shipping-address__menu"
            :items="menuItems"
        />
    </div>
</template>
