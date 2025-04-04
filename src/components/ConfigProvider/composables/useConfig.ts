import { inject } from 'vue';
import { CONFIG_INJECTION_KEY } from '@/components/ConfigProvider/ConfigProvider.lib';

export const useConfig = () => {
    const config = inject(CONFIG_INJECTION_KEY);

    if (!config) {
        throw new Error('ConfigProvider is not provided');
    }

    return config;
};
