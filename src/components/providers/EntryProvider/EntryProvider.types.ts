import type { ProviderProps } from '@/components/providers/Provider/Provider.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';
import type { PortalObject } from '@/types/checkoutSession';

export interface EntryProviderProps {
    /** The entry component's own props, which already carry everything the providers need. */
    entry: EntryBaseProps<PortalObject>;
    componentName: string;
    /** Which portal the entry accepts, decided by the entry rather than by its consumer. */
    allowedPortalTypes: NonNullable<ProviderProps['allowedPortalTypes']>;
    /** Configuration the entry cannot render without, keyed by name, such as `{ invoiceId }`. */
    requiredConfiguration?: Record<string, unknown>;
}
