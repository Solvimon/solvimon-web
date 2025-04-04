import { inject } from 'vue';
import { AUTH_INJECTION_KEY } from '@/components/AuthProvider/AuthProvider.lib';

export const useAuth = () => {
    const auth = inject(AUTH_INJECTION_KEY);

    if (!auth) {
        throw new Error('AuthProvider is not provided');
    }

    return auth;
};
