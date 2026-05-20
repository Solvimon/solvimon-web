<script setup lang="ts">
import { Icon, Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { SecurePaymentsKPIProps } from './SecurePaymentsKPI';

const props = defineProps<SecurePaymentsKPIProps>();

const { $t } = useIntl();

const showAdyen = computed(() =>
    props.paymentMethodOptions.find(
        ({ integration }) => integration.payment_gateway?.variant === 'ADYEN',
    ),
);

const securePaymentsText = computed(() => {
    if (showAdyen.value) {
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
            <Typography tag="span" variant="body-xs" shade="lighter"
                >{{ securePaymentsText }}
                <template v-if="showAdyen">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="40"
                        height="15"
                        fill="none"
                        viewBox="0 0 40 15"
                        class="inline-block translate-y-[1px]"
                    >
                        <path
                            fill="currentColor"
                            d="M.049 2.917h5.845c.646 0 1.17.522 1.17 1.166v5.834H1.217c-.646 0-1.17-.522-1.17-1.167V5.833h2.924v2.334H4.14v-3.5H.049zM32.784 2.917v7h2.922v-5.25h1.17v5.25h2.922V4.083c0-.644-.523-1.166-1.169-1.166zM16.417 12.833h5.845c.646 0 1.17-.522 1.17-1.166v-8.75h-2.924v5.25H19.34v-5.25h-2.922V8.75c0 .645.523 1.167 1.169 1.167h2.922v1.166h-4.091zM31.614 9.917H25.77c-.646 0-1.17-.522-1.17-1.167V2.917h5.846c.646 0 1.17.522 1.17 1.166V7h-2.923V4.667h-1.17v3.5h4.092zM15.248 0v9.917H9.402c-.646 0-1.17-.522-1.17-1.167V4.083c0-.644.524-1.166 1.17-1.166h1.754v5.25h1.169V0z"
                        />
                    </svg>
                </template>
            </Typography>
        </div>
    </div>
</template>
