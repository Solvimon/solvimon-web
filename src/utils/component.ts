import { inject, type InjectionKey } from 'vue';
import { COMPONENT_TAG_PREFIX } from '@/constants';

/**
 * Returns the component name with a prefix.
 */
export function getComponentName(componentName: string): string {
    return `${COMPONENT_TAG_PREFIX}${componentName}`;
}

export function injectOrThrow<T>(key: InjectionKey<T>, providerName: string): T {
    const value = inject(key);

    if (!value) {
        throw new Error(`${providerName} is not provided`);
    }

    return value;
}
