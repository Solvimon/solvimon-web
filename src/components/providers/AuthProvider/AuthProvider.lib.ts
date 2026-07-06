import { onBeforeUnmount, ref, type InjectionKey, type Ref, onMounted } from 'vue';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { getAccessTokenParsed } from '@/utils/accessToken';
import { createTokensService } from '@/services/tokens';
import { parseToken } from '@/utils/token';

export const AUTH_INJECTION_KEY: InjectionKey<ReturnType<typeof getAuth>> = Symbol('auth');

interface SharedTokenState {
    accessToken: Ref<string | undefined>;
    refCount: number;
    refreshInterval: ReturnType<typeof setInterval> | undefined;
    consecutiveRefresh401s: number;
}

function isUnauthorizedError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null || !('statusCode' in err)) return false;
    return err.statusCode === 401;
}

// One shared state per unique token value so N components on the same page
// share a single fetch + refresh cycle instead of each running their own.
const sharedTokenStates = new Map<string, SharedTokenState>();

export const getAuth = (token: string) => {
    const isFirst = !sharedTokenStates.has(token);

    if (isFirst) {
        sharedTokenStates.set(token, {
            accessToken: ref<string | undefined>(),
            refCount: 0,
            refreshInterval: undefined,
            consecutiveRefresh401s: 0,
        });
    }

    const state = sharedTokenStates.get(token)!;
    state.refCount++;

    if (isFirst) {
        const logger = useLogger();
        const { getAccessToken, refreshAccessToken } = createTokensService();
        const { tokenUserName } = parseToken(token);

        const getToken = async () => {
            try {
                state.accessToken.value = (await getAccessToken(tokenUserName)).access_token;
            } catch (err) {
                logger.error('INVALID_TOKEN', 'Failed to fetch access token', {}, err);
            }
        };

        const tryRefresh = async () => {
            try {
                await refreshAccessToken();
                state.consecutiveRefresh401s = 0;
            } catch (err) {
                if (isUnauthorizedError(err)) {
                    state.consecutiveRefresh401s++;
                    if (state.consecutiveRefresh401s >= 2) {
                        clearInterval(state.refreshInterval);
                        state.refreshInterval = undefined;
                    }
                }
            }
        };

        const handleRefreshToken = () => {
            const accessTokenParsed =
                state.accessToken.value && getAccessTokenParsed(state.accessToken.value);

            if (!accessTokenParsed) {
                void tryRefresh();
                return;
            }

            const secondsToExpiry = accessTokenParsed.exp - new Date().getTime() / 1000;

            if (secondsToExpiry < 60) {
                void tryRefresh();
            }
        };

        onMounted(() => {
            void getToken();
            state.refreshInterval = setInterval(handleRefreshToken, 30 * 1000);
        });
    }

    onBeforeUnmount(() => {
        state.refCount--;

        if (state.refCount === 0) {
            clearInterval(state.refreshInterval);
            state.refreshInterval = undefined;
            sharedTokenStates.delete(token);
        }
    });

    return {
        accessToken: state.accessToken,
    };
};
