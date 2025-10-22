import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';

export interface SolvimonCustomerBillingInformationBlockProps extends EntryBaseProps {}

export interface SolvimonCustomerBillingInformationBlockEmits extends EntryBaseEmits {
    (e: 'edit-billing-information', routeName: string): void;
}
