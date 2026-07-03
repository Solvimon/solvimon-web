import type { PaymentMethod } from '@solvimon/solvimon-types';
import { useIntl, type ContextMenuOption, type ContextMenuProps } from '@solvimon/solvimon-ui';

export function usePaymentMethodContextMenuOptions({
    onSetDefault,
    onDeleteRequest,
}: {
    onDeleteRequest: (paymentMethod: PaymentMethod) => void;
    onSetDefault: (paymentMethod: PaymentMethod) => void;
}) {
    const { $t } = useIntl();

    const getContextMenuItems = (paymentMethod: PaymentMethod): ContextMenuProps['items'] => {
        const items: ContextMenuOption[] = [];

        if (!paymentMethod.is_default) {
            items.push({
                label: $t({
                    defaultMessage: 'Set as default',
                    id: 'payment_method.context_menu.set_as_default.label',
                    description: 'Context menu option for setting the default payment method',
                }),
                onClick: () => onSetDefault(paymentMethod),
            });
        }

        items.push({
            label: $t({
                defaultMessage: 'Delete',
                id: 'payment_method.context_menu.delete.label',
                description: 'Context menu option for deleting the payment method',
            }),
            onClick: () => onDeleteRequest(paymentMethod),
        });

        return items;
    };

    return { getContextMenuItems };
}
