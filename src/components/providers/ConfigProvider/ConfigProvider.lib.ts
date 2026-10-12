import type { InjectionKey } from 'vue';
import type { Config } from './ConfigProvider.types';

export const CONFIG_INJECTION_KEY: InjectionKey<Config> = Symbol('config');
