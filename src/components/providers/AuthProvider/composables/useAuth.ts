import { AUTH_INJECTION_KEY } from '@/components/providers/AuthProvider/AuthProvider.lib';
import { injectOrThrow } from '@/utils/component';

export const useAuth = () => injectOrThrow(AUTH_INJECTION_KEY, 'AuthProvider');
