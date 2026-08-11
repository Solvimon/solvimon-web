import type { WalletBalanceValue } from '@solvimon/solvimon-types';
import { formatWalletBalanceValue, useIntl } from '@solvimon/solvimon-ui';
import { computed, type ComputedRef, type Ref } from 'vue';
import type { TopUpModalStep } from './TopUpModal.types';

interface TopUpModalLabels {
    title: ComputedRef<string>;
    subTitle: ComputedRef<string>;
    cancelButtonText: ComputedRef<string>;
    /** Also the label of the success step's single button, which dismisses rather than confirms. */
    confirmButtonText: ComputedRef<string>;
}

/**
 * The top-up modal's chrome. Every label depends on which step is on screen, so they are resolved
 * together rather than spelling the same branch out four times in the component.
 */
export function useTopUpModalLabels({
    step,
    currentBalance,
    topUpValue,
}: {
    step: Ref<TopUpModalStep>;
    /** The wallet balance, already formatted as credits or money. */
    currentBalance: Ref<string>;
    /**
     * What the chosen top-up adds to the wallet, once there is something to charge — credits for a
     * credit based wallet, money otherwise. Named on the confirm button in those same terms, so it
     * reads as the balance does rather than as the card statement will.
     */
    topUpValue: Ref<WalletBalanceValue | undefined>;
}): TopUpModalLabels {
    const { $t, formatNumber } = useIntl();

    const title = computed(() => {
        if (step.value === 'ADD_PAYMENT_METHOD') {
            return $t({
                defaultMessage: 'Add payment method',
                description:
                    'Title of the top-up modal while the customer is adding a payment method',
                id: 'topup_modal.add_payment_method.title',
            });
        }

        if (step.value === 'SUCCESS') {
            return $t({
                defaultMessage: 'Top-up complete',
                description: 'Title of the top-up modal once the top-up has been charged',
                id: 'topup_modal.success.modal_title',
            });
        }

        return $t({
            defaultMessage: 'Top up balance',
            description: 'Title of the wallet top-up modal',
            id: 'topup_modal.title',
        });
    });

    const subTitle = computed(() => {
        if (step.value === 'ADD_PAYMENT_METHOD') {
            return $t({
                defaultMessage: 'Add a new payment method for topping up your balance.',
                description:
                    'Subtitle of the top-up modal while the customer is adding a payment method',
                id: 'topup_modal.add_payment_method.subtitle',
            });
        }

        if (step.value === 'SUCCESS') {
            return $t({
                defaultMessage: 'Your payment went through.',
                description: 'Subtitle of the top-up modal once the top-up has been charged',
                id: 'topup_modal.success.modal_subtitle',
            });
        }

        return $t(
            {
                defaultMessage: 'Your current balance is {balance}.',
                description: 'Subtitle of the top-up modal showing the current wallet balance',
                id: 'topup_modal.subtitle',
            },
            { balance: currentBalance.value },
        );
    });

    // Named for what it does: while adding it steps back to the top-up rather than dismissing.
    const cancelButtonText = computed(() =>
        step.value === 'ADD_PAYMENT_METHOD'
            ? $t({
                  defaultMessage: 'Back',
                  description:
                      'Label of the button that leaves the add payment method step in the top-up modal',
                  id: 'topup_modal.back_button.label',
              })
            : $t({
                  defaultMessage: 'Cancel',
                  description: 'Label of the button that closes the top-up modal',
                  id: 'topup_modal.cancel_button.label',
              }),
    );

    const confirmButtonText = computed(() => {
        if (step.value === 'ADD_PAYMENT_METHOD') {
            return $t({
                defaultMessage: 'Save payment method',
                description:
                    'Label of the confirm button in the top-up modal while adding a payment method',
                id: 'topup_modal.save_payment_method.label',
            });
        }

        if (step.value === 'SUCCESS') {
            return $t({
                defaultMessage: 'Done',
                description:
                    'Label of the button that dismisses the top-up modal once the top-up has been charged',
                id: 'topup_modal.done_button.label',
            });
        }

        if (!topUpValue.value) {
            return $t({
                defaultMessage: 'Top up balance',
                description:
                    'Label of the confirm button in the top-up modal while no amount is entered',
                id: 'topup_modal.confirm_button.empty.label',
            });
        }

        return $t(
            {
                defaultMessage: 'Top up balance with {value}',
                description:
                    'Label of the confirm button in the top-up modal once an amount is entered',
                id: 'topup_modal.confirm_button.label',
            },
            { value: formatWalletBalanceValue($t, formatNumber, topUpValue.value) },
        );
    });

    return { title, subTitle, cancelButtonText, confirmButtonText };
}
