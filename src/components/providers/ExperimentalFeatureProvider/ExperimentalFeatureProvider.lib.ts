import { computed, type ComputedRef, type InjectionKey } from 'vue';

export const EXPERIMENTAL_FEATURE_INJECTION_KEY: InjectionKey<
    ReturnType<typeof getExperimentalFeatures>
> = Symbol('experimentalFeature');

export const EXPERIMENTAL_FEATURES = ['express-checkout'] as const;

export type ExperimentalFeature = (typeof EXPERIMENTAL_FEATURES)[number];

export const getExperimentalFeatures = (
    enabledFeatures: ExperimentalFeature[] = [],
): ComputedRef<Record<ExperimentalFeature, boolean>> => {
    const experimentalFeatures = computed(() =>
        Object.assign(
            {},
            ...EXPERIMENTAL_FEATURES.map((feature) => ({
                [feature]: enabledFeatures.includes(feature),
            })),
        ),
    );

    return experimentalFeatures;
};
