import { getConfig, isSupportedEnvironment } from './lib';
// The real module, reached relatively so the published-build alias on '@/config/internalEnvironments'
// does not apply: these specs run against the published configuration, and this is the other half.
import { internalEnvironments } from './internalEnvironments';

describe('getConfig', () => {
    it('resolves the environments the published package supports', () => {
        expect(getConfig('TEST')).toMatchObject({
            environment: 'TEST',
            apiUrls: { config: 'https://test.api.solvimon.com/v1' },
        });
        expect(getConfig('LIVE')).toMatchObject({
            environment: 'LIVE',
            apiUrls: { config: 'https://api.solvimon.com/v1' },
        });
    });

    /**
     * Specs resolve `@/config/internalEnvironments` through the same alias the published build uses,
     * so this is the behaviour a customer gets: an internal environment names nothing.
     */
    it('refuses an internal environment the way the published build does', () => {
        expect(() => getConfig('DEV')).toThrow(/Unknown Solvimon environment "DEV"/);
        expect(() => getConfig('BETA')).toThrow(/Unknown Solvimon environment "BETA"/);
    });

    it('names the environments a host can use when it refuses one', () => {
        expect(() => getConfig('DEV')).toThrow(/LIVE, TEST/);
    });

    it('refuses a value that is no environment at all', () => {
        expect(() => getConfig('PRODUCTION' as never)).toThrow(/Unknown Solvimon environment/);
    });
});

describe('isSupportedEnvironment', () => {
    it('accepts the published environments and rejects everything else', () => {
        expect(isSupportedEnvironment('TEST')).toBe(true);
        expect(isSupportedEnvironment('LIVE')).toBe(true);
        expect(isSupportedEnvironment('DEV')).toBe(false);
        expect(isSupportedEnvironment('nonsense')).toBe(false);
    });
});

describe('internal environments', () => {
    it('still resolves for a build that opts into them', () => {
        expect(Object.keys(internalEnvironments).sort()).toStrictEqual(['BETA', 'DEV']);
    });

    it('keeps internal hosts out of the public configs', () => {
        const published = JSON.stringify([getConfig('TEST'), getConfig('LIVE')]);

        expect(published).not.toContain('dev.solvimon.com');
        expect(published).not.toContain('beta-solvimon.com');
    });
});
