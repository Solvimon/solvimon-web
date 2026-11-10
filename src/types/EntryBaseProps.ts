import type { PortalUrl } from '@solvimon/solvimon-types';
import type { SolvimonBranding } from '@/types/branding';
import type { ProviderProps } from '@/components/providers/Provider/Provider.types';

/**
 * The properties every element takes: those `EntryProvider` reads from it. Picked rather than
 * omitted, so a prop added to the provider stack does not become element surface by accident.
 */
export type EntryBaseProps<PortalObjectType extends PortalUrl> = Pick<
    ProviderProps,
    | 'environment'
    | 'locale'
    | 'dateLocale'
    | 'messages'
    | 'portalToken'
    | 'experimentalFeatures'
    | 'logLevel'
    | 'onLog'
    | 'cssOverrides'
> & {
    /**
     * The colours every element is drawn in, and the emblem screens show as their avatar.
     */
    branding?: SolvimonBranding;
    portalObject: PortalObjectType;
};
