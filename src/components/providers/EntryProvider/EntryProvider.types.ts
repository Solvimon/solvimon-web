import type { PortalUrl } from '@solvimon/solvimon-types';
import type { ProviderProps } from '@/components/providers/Provider/Provider.types';
import type { EntryBaseProps } from '@/types/EntryBaseProps';

export interface EntryProviderProps {
    /** The entry component's own props, which already carry everything the providers need. */
    entry: EntryBaseProps<PortalUrl>;
    componentName: string;
    /** Which portal the entry accepts, decided by the entry rather than by its consumer. */
    allowedPortalTypes: NonNullable<ProviderProps['allowedPortalTypes']>;
}
