<script setup lang="ts">
import { computed, provide, toRef, watch } from 'vue';
import type { PortalProviderProps } from './PortalProvider.types';
import {
    getPortalUnavailableReason,
    PORTAL_INJECTION_KEY,
} from '@/components/providers/PortalProvider/PortalProvider.lib';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

const props = defineProps<PortalProviderProps>();
const logger = useLogger();

const unavailableReason = computed(() =>
    getPortalUnavailableReason(props.portalObject, props.allowedPortalTypes),
);

watch(
    unavailableReason,
    (reason) => {
        if (reason === 'type-not-allowed') {
            logger.error(
                'PORTAL_TYPE_NOT_ALLOWED',
                `This element does not accept a portal object of type ${props.portalObject.type}`,
                {
                    portalUrlId: props.portalObject.id,
                    allowedPortalTypes: props.allowedPortalTypes,
                },
            );
        } else if (reason === 'not-published') {
            logger.error('RESOURCE_REVOKED', 'The portal object is not published', {
                portalUrlId: props.portalObject.id,
                status: props.portalObject.status,
            });
        }
    },
    { immediate: true },
);

provide(PORTAL_INJECTION_KEY, toRef(props, 'portalObject'));
</script>

<template>
    <slot v-if="!unavailableReason" />
    <slot v-else-if="unavailableReason === 'not-published'" name="unavailable" />
</template>
