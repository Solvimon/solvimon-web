import { COMPONENT_TAG_PREFIX } from '@/constants';

/**
 * Returns the component name with a prefix.
 */
export function getComponentName(componentName: string): string {
    return `${COMPONENT_TAG_PREFIX}${componentName}`;
}
