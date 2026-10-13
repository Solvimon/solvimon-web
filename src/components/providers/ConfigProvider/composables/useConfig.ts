import { CONFIG_INJECTION_KEY } from '@/components/providers/ConfigProvider/ConfigProvider.lib';
import { injectOrThrow } from '@/utils/component';

export const useConfig = () => injectOrThrow(CONFIG_INJECTION_KEY, 'ConfigProvider');
