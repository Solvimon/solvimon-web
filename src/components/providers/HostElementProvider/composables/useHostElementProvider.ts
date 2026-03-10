import { inject } from 'vue';
import { HOST_ELEMENT_PROVIDER_INJECTION_KEY } from '@/components/providers/HostElementProvider/HostElementProvider.lib';

export const useHostElementProvider = () => {
    const context = inject(HOST_ELEMENT_PROVIDER_INJECTION_KEY);

    if (!context) {
        throw new Error('HostElementProvider is not provided');
    }

    return context;
};
