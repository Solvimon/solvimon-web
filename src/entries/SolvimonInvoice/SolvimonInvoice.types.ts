import type { EntryBaseEmits, EntryBaseProps } from '@/types/EntryBaseProps';
import type { InvoiceDetailProps } from '@/views/InvoiceDetail/InvoiceDetail.types';

export interface SolvimonInvoiceProps extends EntryBaseProps, InvoiceDetailProps {}
export interface SolvimonInvoiceEmits extends EntryBaseEmits {
    (e: 'error', payload: { title: string; message: string }): void;
}
