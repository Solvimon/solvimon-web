import { useMediaQuery } from '@/composables/useMediaQuery';

const breakpoints = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
} as const;

type Breakpoint = keyof typeof breakpoints;

export function useBreakpoints() {
    const smaller = (bp: Breakpoint) =>
        useMediaQuery(`(max-width: ${breakpoints[bp] - 1}px)`);

    const smallerOrEqual = (bp: Breakpoint) =>
        useMediaQuery(`(max-width: ${breakpoints[bp]}px)`);

    const greaterOrEqual = (bp: Breakpoint) =>
        useMediaQuery(`(min-width: ${breakpoints[bp]}px)`);

    return { smaller, smallerOrEqual, greaterOrEqual };
}
