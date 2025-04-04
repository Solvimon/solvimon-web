import type { IntlProviderProps } from '@solvimon/ui';
import type { AuthProviderProps } from '@/components/AuthProvider';
import type { ConfigProviderProps } from '@/components/ConfigProvider/ConfigProvider.types';

export interface ProviderProps extends AuthProviderProps, ConfigProviderProps, IntlProviderProps {}
