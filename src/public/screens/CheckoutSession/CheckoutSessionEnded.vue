<script setup lang="ts">
import { Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { PortalLinkEnding } from '@/components/providers/AuthProvider/AuthProvider.lib';

const props = defineProps<{
    /** Why the link could not be signed in with, when it could not. */
    reason?: PortalLinkEnding;
    /** The status of the session, or `CLOSED` for a link that is. */
    status?: string;
    isRedirecting?: boolean;
}>();

const { $t } = useIntl();

const contactSupport = () =>
    $t({
        defaultMessage: 'Contact customer support if you think this is a mistake.',
        description: 'Shown below the notice that an element is no longer available',
        id: 'portal.not_available.description',
    });

const notice = computed(() => {
    if (props.status === 'COMPLETED') {
        return {
            title: $t({
                defaultMessage: 'This checkout has been completed',
                id: 'checkout_session.ended.completed_title',
                description: 'Shown in place of a checkout that the customer already paid for',
            }),
            message: props.isRedirecting
                ? $t({
                      defaultMessage: 'Taking you back…',
                      id: 'checkout_session.ended.redirecting_message',
                      description:
                          'Shown under the completed checkout notice while the page goes to the shop',
                  })
                : undefined,
        };
    }
    if (props.status === 'FAILED') {
        return {
            title: $t({
                defaultMessage: 'We received your payment',
                id: 'checkout_session.ended.failed_title',
                description:
                    'Shown in place of a checkout that was paid for but whose account could not be set up yet',
            }),
            message: $t({
                defaultMessage:
                    'We are finishing your account. There is nothing more you need to do.',
                id: 'checkout_session.ended.failed_message',
                description:
                    'Shown under the notice that the payment was received while the account is being set up',
            }),
        };
    }
    if (props.status === 'PROCESSING') {
        return {
            title: $t({
                defaultMessage: 'We are processing your payment',
                id: 'checkout_session.ended.processing_title',
                description: 'Shown in place of a checkout whose payment is still being processed',
            }),
            message: $t({
                defaultMessage: 'This can take a few minutes. You do not need to pay again.',
                id: 'checkout_session.ended.processing_message',
                description: 'Shown under the notice that the payment is still being processed',
            }),
        };
    }
    if (props.reason === 'expired') {
        return {
            title: $t({
                defaultMessage: 'This checkout link has expired',
                id: 'checkout_session.ended.expired_title',
                description: 'Shown in place of a checkout whose link has expired',
            }),
            message: contactSupport(),
        };
    }
    if (props.reason === 'revoked') {
        return {
            title: $t({
                defaultMessage: 'This checkout is no longer available',
                id: 'checkout_session.ended.revoked_title',
                description: 'Shown in place of a checkout whose link the merchant revoked',
            }),
            message: contactSupport(),
        };
    }
    return {
        title: $t({
            defaultMessage: 'This checkout is closed',
            id: 'checkout_session.ended.closed_title',
            description: 'Shown in place of a checkout that can no longer be used',
        }),
        message: contactSupport(),
    };
});
</script>

<template>
    <div class="sv-checkout-ended flex min-h-96 w-full items-center justify-center">
        <div class="max-w-sm">
            <Typography variant="heading-1" class="sv-checkout-ended__title">{{
                notice.title
            }}</Typography>
            <Typography
                v-if="notice.message"
                variant="body-sm"
                color="subtle"
                class="sv-checkout-ended__message"
                v-bind="isRedirecting && status === 'COMPLETED' ? { role: 'status' } : {}"
                >{{ notice.message }}</Typography
            >
        </div>
    </div>
</template>
