import { onBeforeUnmount, ref, type InjectionKey, onMounted } from 'vue';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { getAccessTokenParsed } from '@/utils/accessToken';
import { createTokensService } from '@/services/tokens';
import { parseToken } from '@/utils/token';

export const AUTH_INJECTION_KEY: InjectionKey<ReturnType<typeof getAuth>> = Symbol('auth');

export const getAuth = (token: string) => {
    const accessToken = ref<string>();
    const refreshInterval = ref<ReturnType<typeof setInterval>>();
    const { getAccessToken, refreshAccessToken } = createTokensService();
    const logger = useLogger();

    const getToken = async () => {
        const { tokenUserName } = parseToken(token);

        try {
            accessToken.value = (await getAccessToken(tokenUserName)).access_token;
        } catch (err) {
            logger.error('INVALID_TOKEN', 'Failed to fetch access token', {}, err);
        }
    };
    const refreshToken = () => {
        void refreshAccessToken();
    };

    onMounted(() => {
        void getToken();
        refreshInterval.value = setInterval(() => handleRefreshToken(), 30 * 1000);
    });

    onBeforeUnmount(() => {
        clearInterval(refreshInterval.value);
        refreshInterval.value = undefined;
    });

    const handleRefreshToken = () => {
        const accessTokenParsed = accessToken.value && getAccessTokenParsed(accessToken.value);

        if (!accessTokenParsed) {
            refreshToken();
            return;
        }

        const secondsToExpiry = accessTokenParsed.exp - new Date().getTime() / 1000;

        if (secondsToExpiry < 60) {
            refreshToken();
        }
    };

    return {
        accessToken,
    };
};
