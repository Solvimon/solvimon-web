<script setup lang="ts">
import { Button, useIntl } from '@solvimon/solvimon-ui';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';

defineEmits<{ (e: 'retry'): void }>();

const { $t } = useIntl();
</script>

<template>
    <EmptyStatePlaceholder class="sv-root sv-component sv-portal-unverified sv-error" icon="error">
        <template #title>
            {{
                $t({
                    defaultMessage: 'We could not open this page',
                    id: 'portal.unverified.title',
                    description:
                        'Shown in place of an element when its portal link could not be checked for now',
                })
            }}
        </template>
        <template #message>
            {{
                $t({
                    defaultMessage: 'Check your connection and try again.',
                    id: 'portal.unverified.message',
                    description: 'Shown below the notice that the portal link could not be checked',
                })
            }}
        </template>
        <template #action>
            <Button
                type="button"
                intent="secondary"
                size="sm"
                class="sv-action sv-action--secondary sv-portal-unverified__retry"
                @click="$emit('retry')"
            >
                {{
                    $t({
                        defaultMessage: 'Try again',
                        id: 'portal.unverified.retry_button.label',
                        description: 'The label of the button that checks the portal link again',
                    })
                }}
            </Button>
        </template>
    </EmptyStatePlaceholder>
</template>
