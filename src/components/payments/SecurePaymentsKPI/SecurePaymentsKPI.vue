<script setup lang="ts">
import { Icon, Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { PaymentGatewayVariant } from '@solvimon/solvimon-types';
import type { SecurePaymentsKPIProps } from './SecurePaymentsKPI';
import adyenLogo from '@/assets/images/vendors/adyen-logo.svg?raw';
import stripeLogo from '@/assets/images/vendors/stripe-logo.svg?raw';

const props = defineProps<SecurePaymentsKPIProps>();

const { $t } = useIntl();

const VENDOR_LOGOS: Record<PaymentGatewayVariant, { svg: string; label: string }> = {
    ADYEN: { svg: adyenLogo, label: 'Adyen' },
    STRIPE: { svg: stripeLogo, label: 'Stripe' },
};

const vendorLogo = computed(() => {
    const entry = props.paymentMethodOptions.find(
        ({ integration }) =>
            integration.payment_gateway?.variant != null &&
            integration.payment_gateway.variant in VENDOR_LOGOS,
    );
    return entry ? VENDOR_LOGOS[entry.integration.payment_gateway!.variant] : null;
});

const securePaymentsText = computed(() => {
    if (vendorLogo.value) {
        return $t({
            defaultMessage: 'Secure and encrypted payments by',
            description:
                'Secure encrypted payments KPI for a specific vendor, followed by a vendor logo',
            id: 'secure_payments_kpi.specific_vendor',
        });
    }

    return $t({
        defaultMessage: 'Secure and encrypted payments',
        description: 'Secure encrypted payments KPI',
        id: 'secure_payments_kpi.generic',
    });
});
</script>

<template>
    <div class="flex justify-around">
        <div class="flex items-center gap-0.5">
            <Icon icon="lock" size="xs" />
            <Typography tag="span" variant="body-xs" shade="lighter">
                <span>{{ securePaymentsText }}</span
                >{{ ' ' }}
                <span
                    v-if="vendorLogo"
                    :aria-label="vendorLogo.label"
                    role="img"
                    class="inline-block h-[15px] align-middle"
                    v-html="vendorLogo.svg"
                />
            </Typography>
        </div>
    </div>
</template>
