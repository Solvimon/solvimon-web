import { useMediaQuery } from '@/composables/useMediaQuery';

/**
 * Whether the viewport is below Tailwind's `sm` breakpoint. Strictly below: at exactly 640px the
 * `sm:` classes already apply, so the layout is no longer the mobile one.
 */
export function useViewport() {
    const isMobileViewport = useMediaQuery('(max-width: 639px)');

    return { isMobileViewport };
}
