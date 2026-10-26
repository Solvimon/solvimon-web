import { useIntl, type ContextMenuOption } from '@solvimon/solvimon-ui';
import type { ShippingAddress } from '@/types/shippingAddress';

/** What can be done with a shipping address, the same wherever its menu is. */
export function useShippingAddressMenuItems({
    onEdit,
    onDelete,
}: {
    onEdit: (address: ShippingAddress) => void;
    onDelete: (address: ShippingAddress) => void;
}) {
    const { $t } = useIntl();

    const getMenuItems = (address: ShippingAddress): ContextMenuOption[] => [
        {
            label: $t({
                defaultMessage: 'Edit',
                id: 'shipping_address.context_menu.edit.label',
                description: 'Menu option that opens the form to change a shipping address',
            }),
            onClick: () => onEdit(address),
        },
        {
            label: $t({
                defaultMessage: 'Delete',
                id: 'shipping_address.context_menu.delete.label',
                description: 'Menu option that deletes a shipping address',
            }),
            onClick: () => onDelete(address),
        },
    ];

    return { getMenuItems };
}
