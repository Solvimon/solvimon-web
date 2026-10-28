import { useShippingAddresses } from './useShippingAddresses';
import type { ShippingAddress } from '@/types/shippingAddress';

const { mockService, mockLoggerError } = vi.hoisted(() => ({
    mockService: {
        getShippingAddresses: vi.fn(),
        createShippingAddress: vi.fn(),
        updateShippingAddress: vi.fn(),
        deleteShippingAddress: vi.fn(),
    },
    mockLoggerError: vi.fn(),
}));

vi.mock('@/services/shippingAddresses', () => ({
    createShippingAddressesService: () => mockService,
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLoggerError }),
}));

const address = (overrides: Partial<ShippingAddress> = {}) =>
    ({
        id: 'shad_1',
        status: 'ACTIVE',
        is_default: false,
        created_at: '2026-10-01T00:00:00Z',
        ...overrides,
    }) as ShippingAddress;

describe('useShippingAddresses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockService.getShippingAddresses.mockResolvedValue({ data: [] });
    });

    it('lists the default address first, then the newest', async () => {
        mockService.getShippingAddresses.mockResolvedValue({
            data: [
                address({ id: 'shad_old', created_at: '2026-01-01T00:00:00Z' }),
                address({ id: 'shad_new', created_at: '2026-09-01T00:00:00Z' }),
                address({
                    id: 'shad_default',
                    is_default: true,
                    created_at: '2025-01-01T00:00:00Z',
                }),
            ],
        });
        const { items, fetchAll } = useShippingAddresses({ customerId: 'cust_1' });

        await fetchAll();

        expect(items.value.map(({ id }) => id)).toEqual(['shad_default', 'shad_new', 'shad_old']);
        expect(mockService.getShippingAddresses).toHaveBeenCalledWith({ customerId: 'cust_1' });
    });

    it('lists only active addresses, whatever else the API returns', async () => {
        mockService.getShippingAddresses.mockResolvedValue({
            data: [
                address({ id: 'shad_draft', status: 'DRAFT' }),
                address({ id: 'shad_active', status: 'ACTIVE' }),
                address({ id: 'shad_retired', status: 'DEPRECATED' }),
            ],
        });
        const addresses = useShippingAddresses({ customerId: 'cust_1' });

        await addresses.fetchAll();

        expect(addresses.items.value.map(({ id }) => id)).toEqual(['shad_active']);
    });

    it('asks for nothing until it knows whose addresses to load', async () => {
        const { fetchAll } = useShippingAddresses({ customerId: () => undefined });

        await fetchAll();

        expect(mockService.getShippingAddresses).not.toHaveBeenCalled();
    });

    it('reports and logs a list that cannot be loaded', async () => {
        const failure = new Error('down');
        mockService.getShippingAddresses.mockRejectedValue(failure);
        const { error, fetchAll } = useShippingAddresses({ customerId: 'cust_1' });

        await fetchAll();

        expect(error.value).toBe(failure);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'SHIPPING_ADDRESSES_LOAD_FAILED',
            'Failed to load the shipping addresses',
            {},
            failure,
        );
    });

    // The list is read again rather than patched, so it shows what the API holds.
    it.each([
        ['stores an address', 'create', 'createShippingAddress'],
        ['deletes an address', 'remove', 'deleteShippingAddress'],
    ] as const)('reloads the list once it %s', async (_, action, serviceCall) => {
        mockService[serviceCall].mockResolvedValue(address());
        const addresses = useShippingAddresses({ customerId: 'cust_1' });

        if (action === 'create') {
            await addresses.create({ customer_id: 'cust_1' } as never);
        } else {
            await addresses[action](address());
        }

        expect(mockService[serviceCall]).toHaveBeenCalled();
        expect(mockService.getShippingAddresses).toHaveBeenCalledTimes(1);
    });

    it('stores a new address as active, so it is listed and can be the default', async () => {
        mockService.createShippingAddress.mockResolvedValue(address());
        const addresses = useShippingAddresses({ customerId: 'cust_1' });

        await addresses.create({ customer_id: 'cust_1', reference: 'ref_1' } as never);

        expect(mockService.createShippingAddress).toHaveBeenCalledWith({
            customer_id: 'cust_1',
            reference: 'ref_1',
            status: 'ACTIVE',
        });
    });

    it('deletes by the address id', async () => {
        const addresses = useShippingAddresses({ customerId: 'cust_1' });

        await addresses.remove(address({ id: 'shad_9' }));

        expect(mockService.deleteShippingAddress).toHaveBeenCalledWith({
            shippingAddressId: 'shad_9',
        });
    });

    describe('replacing an address', () => {
        const payload = { customer_id: 'cust_1', reference: 'ref_new' } as never;
        const stored = address({ id: 'shad_new', status: 'ACTIVE', reference: 'ref_1' });

        beforeEach(() => {
            mockService.createShippingAddress.mockResolvedValue(stored);
        });

        it('stores the edit as a new active address and retires the old one', async () => {
            const addresses = useShippingAddresses({ customerId: 'cust_1' });

            const replacement = await addresses.replace(address({ id: 'shad_old' }), payload, {});

            expect(replacement).toBe(stored);
            expect(mockService.createShippingAddress).toHaveBeenCalledWith({
                customer_id: 'cust_1',
                reference: 'ref_new',
                status: 'ACTIVE',
            });
            expect(mockService.deleteShippingAddress).toHaveBeenCalledWith({
                shippingAddressId: 'shad_old',
            });
            expect(mockService.getShippingAddresses).toHaveBeenCalledTimes(1);
        });

        it('keeps the old address when the new one cannot be stored', async () => {
            const failure = new Error('nope');
            mockService.createShippingAddress.mockRejectedValue(failure);
            const addresses = useShippingAddresses({ customerId: 'cust_1' });

            await expect(addresses.replace(address({ id: 'shad_old' }), payload, {})).rejects.toBe(
                failure,
            );
            expect(mockService.deleteShippingAddress).not.toHaveBeenCalled();
        });

        it('retires the old address on the next try without storing the edit again', async () => {
            mockService.deleteShippingAddress.mockRejectedValueOnce(new Error('nope'));
            const addresses = useShippingAddresses({ customerId: 'cust_1' });
            const progress = {};
            const old = address({ id: 'shad_old' });

            await expect(addresses.replace(old, payload, progress)).rejects.toThrow('nope');
            expect(progress).toMatchObject({ replacement: stored });

            await addresses.replace(old, payload, progress);

            expect(mockService.createShippingAddress).toHaveBeenCalledTimes(1);
            expect(mockService.deleteShippingAddress).toHaveBeenCalledTimes(2);
        });

        it('saves a correction made since onto the stored replacement on the next try', async () => {
            mockService.deleteShippingAddress.mockRejectedValueOnce(new Error('nope'));
            const corrected = address({ id: 'shad_new', status: 'ACTIVE' });
            mockService.updateShippingAddress.mockResolvedValue(corrected);
            const addresses = useShippingAddresses({ customerId: 'cust_1' });
            const progress = {};
            const old = address({ id: 'shad_old' });
            const typo = {
                customer_id: 'cust_1',
                reference: 'ref_1',
                address: { line1: 'Damrk 1' },
            } as never;
            const fixed = {
                customer_id: 'cust_1',
                reference: 'ref_2',
                address: { line1: 'Damrak 1' },
            } as never;

            await expect(addresses.replace(old, typo, progress)).rejects.toThrow('nope');
            const replacement = await addresses.replace(old, fixed, progress);

            expect(mockService.createShippingAddress).toHaveBeenCalledTimes(1);
            expect(mockService.updateShippingAddress).toHaveBeenCalledWith({
                shippingAddressId: 'shad_new',
                payload: {
                    customer_id: 'cust_1',
                    reference: stored.reference,
                    address: { line1: 'Damrak 1' },
                },
            });
            expect(replacement).toBe(corrected);
        });

        it('does not touch the stored replacement when the form is unchanged but for its reference', async () => {
            mockService.deleteShippingAddress.mockRejectedValueOnce(new Error('nope'));
            const addresses = useShippingAddresses({ customerId: 'cust_1' });
            const progress = {};
            const old = address({ id: 'shad_old' });

            await expect(
                addresses.replace(
                    old,
                    { customer_id: 'cust_1', reference: 'ref_1' } as never,
                    progress,
                ),
            ).rejects.toThrow('nope');
            await addresses.replace(
                old,
                { customer_id: 'cust_1', reference: 'ref_2' } as never,
                progress,
            );

            expect(mockService.updateShippingAddress).not.toHaveBeenCalled();
        });
    });
});
