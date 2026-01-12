import { inject } from 'vue';
import { EXPERIMENTAL_FEATURE_INJECTION_KEY } from '@/components/providers/ExperimentalFeatureProvider/ExperimentalFeatureProvider.lib';

export const useExperimentalFeature = () => {
    const experimentalFeature = inject(EXPERIMENTAL_FEATURE_INJECTION_KEY);

    return experimentalFeature;
};
