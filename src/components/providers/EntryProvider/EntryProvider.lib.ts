import type { EntryProviderProps } from './EntryProvider.types';

/**
 * The required properties an entry has no value for. A custom element cannot make a property
 * required, so a host can mount one without them or set them later; the entry waits instead of
 * failing in setup, where nothing would report it and the element would never recover.
 */
export function getMissingProperties(
    entry: EntryProviderProps['entry'],
    requiredConfiguration: EntryProviderProps['requiredConfiguration'] = {},
): string[] {
    return [
        ...(entry.environment ? [] : ['environment']),
        ...(entry.portalObject ? [] : ['portalObject']),
        ...Object.entries(requiredConfiguration)
            .filter(([, value]) => !value)
            .map(([key]) => `configuration.${key}`),
    ];
}
