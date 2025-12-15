import type { PlatformBranding } from '@solvimon/types';
import type { ProviderEmits, ProviderProps } from '@/components/providers/Provider/Provider.types';

export type EntryBaseProps = ProviderProps & {
    /**
     * The branding for the checkout.
     */
    branding?: PlatformBranding;
};
export type EntryBaseEmits = ProviderEmits;
