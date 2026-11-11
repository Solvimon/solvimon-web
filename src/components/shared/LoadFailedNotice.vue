<script setup lang="ts">
import { ErrorNotification, useIntl } from '@solvimon/solvimon-ui';

const { $t } = useIntl();
</script>

<template>
    <ErrorNotification
        class="sv-load-failed sv-error"
        :title="
            $t({
                defaultMessage: 'This could not be loaded. Please try again later.',
                id: 'shared.load_failed.title',
                description:
                    'Shown in place of a part of the page whose data failed to load, such as the billing information',
            })
        "
    />
</template>
