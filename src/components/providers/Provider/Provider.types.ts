import type { IntlProviderProps, BrandProviderProps } from '@solvimon/ui';
import type { LoggerProviderProps } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import type { ExperimentalFeatureProviderProps } from '@/components/providers/ExperimentalFeatureProvider/ExperimentalFeatureProvider.types';
import type { PortalProviderProps } from '@/components/providers/PortalProvider/PortalProvider.types';
import type { AuthProviderProps } from '@/components/providers/AuthProvider';
import type { ConfigProviderProps } from '@/components/providers/ConfigProvider/ConfigProvider.types';

export interface RequiredProviderProps
    extends
        AuthProviderProps,
        ConfigProviderProps,
        IntlProviderProps,
        BrandProviderProps,
        ExperimentalFeatureProviderProps,
        LoggerProviderProps,
        Pick<PortalProviderProps, 'allowedPortalTypes' | 'portalObject'> {}
export interface ProviderEmits {
    (e: 'error', error: Error): void;
}

export type ProviderProps = Partial<RequiredProviderProps> &
    Required<Pick<RequiredProviderProps, 'customElementName'>>;
