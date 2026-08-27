type UnknownRecord = Record<string, unknown>;

const isMergeable = (value: unknown): value is UnknownRecord =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Fills in the options a consumer left out of a `configuration` prop.
 *
 * Vue only applies a prop default when the prop is absent, but the SDK assigns `configuration` onto
 * the custom element for every mount, so the prop is always defined and the default never runs.
 * Without merging, every option the consumer did not name arrives as `undefined` and silently turns
 * the feature off. Merging onto the defaults keeps those options at their documented values.
 *
 * Nested plain objects are merged recursively; arrays, functions and class instances are taken from
 * the configuration as they are.
 */
export function resolveConfiguration<TDefaults extends object, TConfiguration extends object>(
    defaults: TDefaults,
    configuration?: TConfiguration,
): TDefaults & TConfiguration {
    // The merge is structural, so it is walked as records and typed again on the way out.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const resolved = { ...defaults } as UnknownRecord;

    for (const [key, value] of Object.entries(configuration ?? {})) {
        if (value === undefined) {
            continue;
        }

        const fallback = resolved[key];

        resolved[key] =
            isMergeable(fallback) && isMergeable(value)
                ? resolveConfiguration(fallback, value)
                : value;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return resolved as TDefaults & TConfiguration;
}
