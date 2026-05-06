<script setup lang="ts">
import { Icon, Typography, useIntl } from '@solvimon/solvimon-ui';
import Placeholder from '@/components/shared/Placeholder.vue';

const { $t } = useIntl();
</script>

<template>
    <Placeholder class="flex h-40 items-center justify-center">
        <div class="flex flex-col items-center gap-2">
            <Typography tag="span" shade="lighter"><Icon size="lg" icon="person_pin" /></Typography>
            <Typography tag="span" variant="body-xs" shade="lighter">
                {{
                    $t({
                        defaultMessage: 'Select a country to see the available payment methods',
                        description:
                            'The message shown when no country is selected in the checkout',
                        id: 'checkout.payment_methods.no_country_selected_message',
                    })
                }}
            </Typography>
        </div>
    </Placeholder>
</template>
