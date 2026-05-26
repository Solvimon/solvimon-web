import { onBeforeUnmount, ref, type InjectionKey, onMounted } from 'vue';
import type { AuthInstance } from './AuthProvider.types';
import { trackSentryException } from '@/utils/errorTracking';
import { getAccessTokenParsed } from '@/utils/accessToken';
import { createTokensService } from '@/services/tokens';
import { parseToken } from '@/utils/token';

export const AUTH_INJECTION_KEY: InjectionKey<ReturnType<typeof getAuth>> = Symbol('auth');

// Module-level registry so multiple providers on the same page share one token fetch
// and one refresh interval instead of making duplicate requests.
const authInstances = new Map<string, AuthInstance>();

export const getAuth = (token: string) => {
    if (!authInstances.has(token)) {
        const accessToken = ref<string>();
        const { getAccessToken, refreshAccessToken } = createTokensService();
        let refreshInterval: ReturnType<typeof setInterval> | undefined;

        const fetchToken = async () => {
            const { tokenUserName } = parseToken(token);
            try {
                accessToken.value = (await getAccessToken(tokenUserName)).access_token;
            } catch (_err) {
                trackSentryException();
            }
        };

        const handleRefreshToken = () => {
            const accessTokenParsed = accessToken.value && getAccessTokenParsed(accessToken.value);
            if (!accessTokenParsed) {
                void refreshAccessToken();
                return;
            }
            const secondsToExpiry = accessTokenParsed.exp - new Date().getTime() / 1000;
            if (secondsToExpiry < 60) {
                void refreshAccessToken();
            }
        };

        authInstances.set(token, {
            accessToken,
            refCount: 0,
            started: false,
            start: () => {
                void fetchToken();
                refreshInterval = setInterval(handleRefreshToken, 30 * 1000);
            },
            stop: () => {
                clearInterval(refreshInterval);
                refreshInterval = undefined;
                authInstances.delete(token);
            },
        });
    }

    const instance = authInstances.get(token)!;
    instance.refCount++;

    onMounted(() => {
        if (!instance.started) {
            instance.started = true;
            instance.start();
        }
    });

    onBeforeUnmount(() => {
        instance.refCount--;
        if (instance.refCount === 0) {
            instance.stop();
        }
    });

    return { accessToken: instance.accessToken };
};
