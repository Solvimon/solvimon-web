import { useBreakpoints } from '@/composables/useBreakpoints';

/**
 * A composable to check if the viewport size
 */
export function useViewport() {
    const breakpoints = useBreakpoints();
    const isMobileViewport = breakpoints.smallerOrEqual('sm');

    return { isMobileViewport };
}
