import { useIntl } from '@solvimon/solvimon-ui';
import { computed, type ComputedRef, type Ref } from 'vue';
import type { SubscriptionCancellationVariant } from '@/services/subscriptions';

interface SubscriptionCancellationModalLabels {
    title: ComputedRef<string>;
    explanation: ComputedRef<string>;
    confirmButtonText: ComputedRef<string>;
    cancelButtonText: ComputedRef<string>;
    errorMessage: ComputedRef<string>;
}

export function useSubscriptionCancellationModalLabels({
    variant,
    renewableUntil,
    billingPeriodEndsAt,
}: {
    variant: Ref<SubscriptionCancellationVariant | undefined>;
    renewableUntil: Ref<string | undefined>;
    billingPeriodEndsAt: Ref<string | undefined>;
}): SubscriptionCancellationModalLabels {
    const { $t } = useIntl();

    const isRenewing = computed(() => variant.value === 'RENEW');

    const title = computed(() =>
        isRenewing.value
            ? $t({
                  defaultMessage: 'Renew subscription',
                  description: 'Title of the renew subscription confirmation modal',
                  id: 'subscription_cancellation_modal.renew.title',
              })
            : $t({
                  defaultMessage: 'Cancel subscription',
                  description: 'Title of the cancel subscription confirmation modal',
                  id: 'subscription_cancellation_modal.cancel.title',
              }),
    );

    const explanation = computed(() => {
        if (!isRenewing.value) {
            if (billingPeriodEndsAt.value) {
                return $t(
                    {
                        defaultMessage:
                            'Your subscription will be canceled, but you’ll continue to have access until {date}.',
                        description:
                            'Explanation of what happens when a running subscription is cancelled, naming the date access ends, shown in the cancel subscription modal',
                        id: 'subscription_cancellation_modal.cancel.explanation_with_date',
                    },
                    { date: billingPeriodEndsAt.value },
                );
            }

            return $t({
                defaultMessage:
                    'Your subscription will be canceled, but you’ll continue to have access until the end of the billing period.',
                description:
                    'Explanation of what happens when a running subscription is cancelled, shown in the cancel subscription modal',
                id: 'subscription_cancellation_modal.cancel.explanation',
            });
        }

        if (!renewableUntil.value) {
            return $t({
                defaultMessage:
                    'Your subscription will continue as before, and billing will resume on its usual schedule.',
                description:
                    'Explanation of what happens when a cancellation is undone, shown in the renew subscription modal when no end date is known',
                id: 'subscription_cancellation_modal.renew.explanation',
            });
        }

        return $t(
            {
                defaultMessage:
                    'You can renew your subscription until {date}. After this period you can only create a new subscription.',
                description:
                    'Explanation of the deadline for undoing a cancellation, shown in the renew subscription modal',
                id: 'subscription_cancellation_modal.renew.explanation_with_date',
            },
            { date: renewableUntil.value },
        );
    });

    const confirmButtonText = computed(() =>
        isRenewing.value
            ? $t({
                  defaultMessage: 'Renew subscription',
                  description: 'Label of the confirm button in the renew subscription modal',
                  id: 'subscription_cancellation_modal.renew.confirm_button.label',
              })
            : $t({
                  defaultMessage: 'Cancel subscription',
                  description: 'Label of the confirm button in the cancel subscription modal',
                  id: 'subscription_cancellation_modal.cancel.confirm_button.label',
              }),
    );

    const cancelButtonText = computed(() =>
        $t({
            defaultMessage: 'Cancel',
            description: 'Label of the button that dismisses the cancellation modal',
            id: 'subscription_cancellation_modal.cancel_button.label',
        }),
    );

    const errorMessage = computed(() =>
        isRenewing.value
            ? $t({
                  defaultMessage: 'We could not renew your subscription. Please try again.',
                  description: 'Error shown when undoing a cancellation fails',
                  id: 'subscription_cancellation_modal.renew.error',
              })
            : $t({
                  defaultMessage: 'We could not cancel your subscription. Please try again.',
                  description: 'Error shown when cancelling a subscription fails',
                  id: 'subscription_cancellation_modal.cancel.error',
              }),
    );

    return { title, explanation, confirmButtonText, cancelButtonText, errorMessage };
}
