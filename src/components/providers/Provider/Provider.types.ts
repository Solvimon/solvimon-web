import type { IntlProviderProps } from '@solvimon/ui';
import type { PortalProviderProps } from '@/components/providers/PortalProvider/PortalProvider.types';
import type { AuthProviderProps } from '@/components/providers/AuthProvider';
import type { ConfigProviderProps } from '@/components/providers/ConfigProvider/ConfigProvider.types';

export interface RequiredProviderProps
    extends AuthProviderProps,
        ConfigProviderProps,
        IntlProviderProps,
        Pick<PortalProviderProps, 'allowedPortalTypes' | 'portalObject'> {}
export interface ProviderEmits {
    (e: 'error', error: Error): void;
}

export type ProviderProps = Partial<RequiredProviderProps>;
