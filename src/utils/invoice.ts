import type { Invoice } from '@solvimon/types';

export const isInvoiceUsageBased = (invoice: Invoice) => {
    return (
        invoice.periods?.some((period) =>
            period.groups.some((group) =>
                group.lines?.some((line) =>
                    line.product_items.some(
                        (productItem) => productItem.model_type === 'USAGE_BASED',
                    ),
                ),
            ),
        ) ?? false
    );
};
