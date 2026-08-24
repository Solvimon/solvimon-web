/**
 * Mirrors solvimon-ui's own `SectionProps`, which its build declares but does not export — the
 * `Section` component comes through, the type describing its props does not. `defineProps` has to
 * resolve every member at compile time, so it cannot be extended from there or derived from the
 * component, and a wrapper that forwards its props needs the whole shape rather than the three it
 * happens to be passed today.
 *
 * Delete this in favour of importing the type once solvimon-ui exports it.
 */
interface OriginalSectionProps {
    contentClasses?: string;
    contentBackground?: 'gray' | 'none';
    title?: string;
    noSpacing?: boolean;
    hasError?: boolean;
    noBorder?: boolean;
}

export interface SectionProps extends OriginalSectionProps {
    emphasized?: boolean;
}
