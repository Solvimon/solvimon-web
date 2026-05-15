import type { PlatformBranding, PortalUrl } from '@solvimon/solvimon-types';
import type { ProviderEmits, ProviderProps } from '@/components/providers/Provider/Provider.types';

export type EntryBaseProps<PortalObjectType extends PortalUrl> = Omit<ProviderProps, 'customElementName'> & {
    /**
     * The branding for the checkout.
     */
    branding?: PlatformBranding;
    portalObject: PortalObjectType;
};

export type EntryBaseEmits = ProviderEmits;
