import type { Invoice } from '@solvimon/solvimon-types';

export interface TopUpModalSuccessProps {
    /** The invoice the charge produced, shown as the receipt for it. */
    invoice?: Invoice;
}
