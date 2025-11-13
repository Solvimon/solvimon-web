<script setup lang="ts">
import { Typography, useIntl } from '@solvimon/ui';

const { $t } = useIntl();

const handleReload = () => {
    window.location.reload();
};
</script>

<template>
    <div class="flex w-full min-h-96 justify-center items-center">
        <div class="max-w-sm">
            <Typography variant="heading-1">{{
                $t({
                    defaultMessage: 'Checkout not available',
                    id: 'checkout.not_available.title',
                    description: 'The title of the checkout not available page',
                })
            }}</Typography>
            <Typography variant="body-sm" shade="lighter">
                {{
                    $t({
                        defaultMessage: 'The checkout is currently not available.',
                        id: 'checkout.not_available.description',
                        description: 'The description of the checkout not available page',
                    })
                }}
                <a
                    href="#"
                    class="text-primary-900 hover:underline"
                    @click.prevent="handleReload"
                    >{{
                        $t({
                            defaultMessage: 'Reload',
                            id: 'checkout.not_available.reload_button',
                            description: 'The label of the reload button',
                        })
                    }}</a
                >
                {{
                    $t({
                        defaultMessage: 'this page to try again, or contact customer support.',
                        id: 'checkout.not_available.contact_support_message',
                        description:
                            'The message shown when the user wants to contact customer support',
                    })
                }}</Typography
            >
        </div>
    </div>
</template>
