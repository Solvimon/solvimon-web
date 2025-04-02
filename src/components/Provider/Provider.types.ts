import { IntlProviderProps } from '@solvimon/ui';
import { AuthProviderProps } from '../AuthProvider';
import { ConfigProviderProps } from '../ConfigProvider/ConfigProvider.types';

export interface ProviderProps extends AuthProviderProps, ConfigProviderProps, IntlProviderProps {}