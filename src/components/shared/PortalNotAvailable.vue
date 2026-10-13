<script setup lang="ts">
import { ErrorNotification, useIntl } from '@solvimon/solvimon-ui';

const { $t } = useIntl();
</script>

<template>
    <ErrorNotification
        class="sv-root sv-component sv-portal-unavailable sv-error"
        :title="
            $t({
                defaultMessage: 'This is no longer available.',
                description:
                    'Shown in place of an element whose portal link has been revoked by the merchant',
                id: 'portal.not_available.title',
            })
        "
        :description="
            $t({
                defaultMessage: 'Contact customer support if you think this is a mistake.',
                description: 'Shown below the notice that an element is no longer available',
                id: 'portal.not_available.description',
            })
        "
    />
</template>
