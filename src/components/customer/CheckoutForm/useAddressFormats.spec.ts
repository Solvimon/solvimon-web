import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { useAddressFormats } from './useAddressFormats';

const { mockLoadAddressFormats, mockGetAddressFormat } = vi.hoisted(() => ({
    mockLoadAddressFormats: vi.fn(),
    mockGetAddressFormat: vi.fn(),
}));

vi.mock('./addressFormat', () => ({
    loadAddressFormats: mockLoadAddressFormats,
    getAddressFormat: mockGetAddressFormat,
}));

describe('useAddressFormats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAddressFormat.mockImplementation((_, country) => ({ country }));
    });

    it('downloads nothing while no form needs the formats', async () => {
        const { formatOf } = useAddressFormats({ isNeeded: () => false, countries: [] });
        await flushPromises();

        expect(mockLoadAddressFormats).not.toHaveBeenCalled();
        expect(formatOf('NL')).toBeUndefined();
    });

    it("hands out a country's format once they are downloaded", async () => {
        mockLoadAddressFormats.mockResolvedValue({});
        const { formatOf } = useAddressFormats({ isNeeded: () => true, countries: [] });
        await flushPromises();

        expect(formatOf('NL')).toEqual({ country: 'NL' });
    });

    it('tries a failed download again when the country changes', async () => {
        mockLoadAddressFormats.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});
        const country = ref('NL');
        const { formatOf } = useAddressFormats({ isNeeded: () => true, countries: [country] });
        await flushPromises();

        expect(formatOf('NL')).toBeUndefined();

        country.value = 'BE';
        await flushPromises();

        expect(mockLoadAddressFormats).toHaveBeenCalledTimes(2);
        expect(formatOf('BE')).toEqual({ country: 'BE' });
    });
});
