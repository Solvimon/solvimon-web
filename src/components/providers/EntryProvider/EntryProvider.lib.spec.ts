import type { CustomerPortalUrl, Environment } from '@solvimon/solvimon-types';
import { getMissingProperties } from './EntryProvider.lib';
import type { EntryProviderProps } from './EntryProvider.types';
import { createTestPortalObject } from '@/test-utils/portalObjectFixture';

const entry = (overrides: Partial<EntryProviderProps['entry']> = {}) =>
    ({
        environment: 'TEST',
        portalObject: createTestPortalObject(),
        ...overrides,
    }) as EntryProviderProps['entry'];

describe('getMissingProperties', () => {
    it('finds nothing missing on a complete entry', () => {
        expect(getMissingProperties(entry())).toEqual([]);
    });

    it('names the environment and portal object when they have no value', () => {
        expect(
            getMissingProperties(
                entry({
                    environment: undefined as unknown as Environment,
                    portalObject: undefined as unknown as CustomerPortalUrl,
                }),
            ),
        ).toEqual(['environment', 'portalObject']);
    });

    it('names required configuration by its path, and only the entries without a value', () => {
        expect(
            getMissingProperties(entry(), { invoiceId: undefined, subscriptionId: 'sub_1' }),
        ).toEqual(['configuration.invoiceId']);
    });

    it('treats an empty string as missing, as a cleared attribute would be', () => {
        expect(getMissingProperties(entry(), { invoiceId: '' })).toEqual([
            'configuration.invoiceId',
        ]);
    });
});
