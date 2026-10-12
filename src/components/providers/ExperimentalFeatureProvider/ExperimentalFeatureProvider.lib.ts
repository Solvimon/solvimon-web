import { computed, toValue, type ComputedRef, type InjectionKey, type MaybeRefOrGetter } from 'vue';

export const EXPERIMENTAL_FEATURE_INJECTION_KEY: InjectionKey<
    ReturnType<typeof getExperimentalFeatures>
> = Symbol('experimentalFeature');

export const EXPERIMENTAL_FEATURES = ['express-checkout'] as const;

export type ExperimentalFeature = (typeof EXPERIMENTAL_FEATURES)[number];

export const getExperimentalFeatures = (
    enabledFeatures: MaybeRefOrGetter<ExperimentalFeature[] | undefined>,
): ComputedRef<Record<ExperimentalFeature, boolean>> => {
    const experimentalFeatures = computed(() => {
        const enabled = toValue(enabledFeatures) ?? [];

        return Object.assign(
            {},
            ...EXPERIMENTAL_FEATURES.map((feature) => ({
                [feature]: enabled.includes(feature),
            })),
        );
    });

    return experimentalFeatures;
};
