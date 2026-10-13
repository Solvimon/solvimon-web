import { HOST_ELEMENT_PROVIDER_INJECTION_KEY } from '@/components/providers/HostElementProvider/HostElementProvider.lib';
import { injectOrThrow } from '@/utils/component';

export const useHostElementProvider = () =>
    injectOrThrow(HOST_ELEMENT_PROVIDER_INJECTION_KEY, 'HostElementProvider');
