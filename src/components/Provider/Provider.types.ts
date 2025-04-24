import type { IntlProviderProps } from '@solvimon/ui';
import type { AuthProviderProps } from '@/components/AuthProvider';
import type { ConfigProviderProps } from '@/components/ConfigProvider/ConfigProvider.types';

export interface RequiredProviderProps
    extends AuthProviderProps,
        ConfigProviderProps,
        IntlProviderProps {}

export type ProviderProps = Partial<RequiredProviderProps>;
