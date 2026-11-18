import { useIntl, type ContextMenuOption } from '@solvimon/solvimon-ui';
import type { PaymentAcceptor } from '@solvimon/solvimon-types';

/** What can be done with a payment acceptor, the same wherever its menu is. */
export function usePaymentAcceptorMenuItems({
    onEdit,
    onDelete,
}: {
    onEdit: (paymentAcceptor: PaymentAcceptor) => void;
    onDelete: (paymentAcceptor: PaymentAcceptor) => void;
}) {
    const { $t } = useIntl();

    const getMenuItems = (paymentAcceptor: PaymentAcceptor): ContextMenuOption[] => [
        {
            label: $t({
                defaultMessage: 'Edit',
                id: 'payment_acceptor.context_menu.edit.label',
                description: 'Menu option that opens the form to change a bank account',
            }),
            onClick: () => onEdit(paymentAcceptor),
        },
        {
            label: $t({
                defaultMessage: 'Delete',
                id: 'payment_acceptor.context_menu.delete.label',
                description: 'Menu option that deletes a bank account',
            }),
            onClick: () => onDelete(paymentAcceptor),
        },
    ];

    return { getMenuItems };
}
