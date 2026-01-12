import { describe, it, expect } from 'vitest';
import { getExperimentalFeatures, EXPERIMENTAL_FEATURES } from './ExperimentalFeatureProvider.lib';
import type { ExperimentalFeature } from './ExperimentalFeatureProvider.lib';

describe('getExperimentalFeatures', () => {
    it('should return a computed ref with all features mapped to their enabled status', () => {
        const enabledFeatures: ExperimentalFeature[] = ['express-checkout'];
        const result = getExperimentalFeatures(enabledFeatures);

        expect(result.value).toEqual({ 'express-checkout': true });
    });

    it('should return false for features that are not enabled', () => {
        const enabledFeatures: ExperimentalFeature[] = [];
        const result = getExperimentalFeatures(enabledFeatures);

        expect(result.value).toEqual({ 'express-checkout': false });
    });

    it('should handle multiple features when EXPERIMENTAL_FEATURES array is extended', () => {
        const enabledFeatures: ExperimentalFeature[] = ['express-checkout'];
        const result = getExperimentalFeatures(enabledFeatures);

        expect(Object.keys(result.value)).toHaveLength(EXPERIMENTAL_FEATURES.length);
        expect(result.value['express-checkout']).toBe(true);
    });

    it('should return a reactive computed ref', () => {
        const enabledFeatures: ExperimentalFeature[] = [];
        const result = getExperimentalFeatures(enabledFeatures);

        expect(result.value).toEqual({ 'express-checkout': false });
        expect(typeof result.value).toBe('object');
        expect(Array.isArray(result.value)).toBe(false);
    });

    it('should correctly identify which features are enabled', () => {
        const enabledFeatures: ExperimentalFeature[] = ['express-checkout'];
        const result = getExperimentalFeatures(enabledFeatures);

        expect(result.value['express-checkout']).toBe(true);
    });
});
