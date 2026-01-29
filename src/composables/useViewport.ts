import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

/**
 * A composable to check if the viewport size
 */
export function useViewport() {
    const breakpoints = useBreakpoints(breakpointsTailwind);
    const isMobileViewport = breakpoints.smallerOrEqual('sm');

    return { isMobileViewport };
}
