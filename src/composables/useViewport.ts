import { useBreakpoints } from '@/composables/useBreakpoints';

/**
 * Whether the viewport is below Tailwind's `sm` breakpoint. Strictly below: at exactly 640px the
 * `sm:` classes already apply, so the layout is no longer the mobile one.
 */
export function useViewport() {
    const breakpoints = useBreakpoints();
    const isMobileViewport = breakpoints.smaller('sm');

    return { isMobileViewport };
}
