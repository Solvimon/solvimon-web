import type { PlatformBranding } from '@solvimon/solvimon-types';
import type { PortalObject } from '@/types/checkoutSession';
import type { ProviderEmits, ProviderProps } from '@/components/providers/Provider/Provider.types';

export type EntryBaseProps<PortalObjectType extends PortalObject> = Omit<
    ProviderProps,
    'customElementName'
> & {
    /**
     * The branding for the checkout.
     */
    branding?: PlatformBranding;
    portalObject: PortalObjectType;
};

export type EntryBaseEmits = ProviderEmits;
