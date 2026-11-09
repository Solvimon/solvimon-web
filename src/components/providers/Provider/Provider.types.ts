import type { BrandProviderProps } from '@solvimon/solvimon-ui';
import type { HostElementProviderProps } from '@/components/providers/HostElementProvider/HostElementProvider.types';
import type { LoggerProviderProps } from '@/components/providers/LoggerProvider/LoggerProvider.types';
import type { ExperimentalFeatureProviderProps } from '@/components/providers/ExperimentalFeatureProvider/ExperimentalFeatureProvider.types';
import type { PortalProviderProps } from '@/components/providers/PortalProvider/PortalProvider.types';
import type { AuthProviderProps } from '@/components/providers/AuthProvider';
import type { AuthStatus } from '@/components/providers/AuthProvider/AuthProvider.lib';
import type { ConfigProviderProps } from '@/components/providers/ConfigProvider/ConfigProvider.types';
import type { TranslationProviderProps } from '@/components/providers/TranslationProvider/TranslationProvider.types';
import type { CssOverridesProviderProps } from '@/components/providers/CssOverridesProvider/CssOverridesProvider.types';

export interface RequiredProviderProps
    extends
        Omit<AuthProviderProps, 'token' | 'authentication'>,
        ConfigProviderProps,
        TranslationProviderProps,
        BrandProviderProps,
        ExperimentalFeatureProviderProps,
        LoggerProviderProps,
        Pick<PortalProviderProps, 'allowedPortalTypes' | 'portalObject'>,
        HostElementProviderProps,
        CssOverridesProviderProps {}
export interface ProviderEmits {
    (e: 'error', error: Error): void;
}

export type ProviderProps = RequiredProviderProps;

export interface ProviderSlots {
    default?: () => unknown;
    /** `ending` is set when the exchange found the link expired, revoked or closed. */
    'portal-unavailable'?: (props: { ending?: Extract<AuthStatus, { state: 'ended' }> }) => unknown;
}
