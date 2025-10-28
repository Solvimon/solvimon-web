import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';

export type SolvimonCustomerBillingInformationBlockProps = EntryBaseProps;

export interface SolvimonCustomerBillingInformationBlockEmits extends EntryBaseEmits {
    (e: 'edit-billing-information', routeName: string): void;
    (e: 'error', payload: { title: string; message: string }): void;
}
