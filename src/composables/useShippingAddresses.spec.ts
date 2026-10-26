import { useShippingAddresses } from './useShippingAddresses';
import type { ShippingAddress } from '@/types/shippingAddress';

const { mockService, mockLoggerError } = vi.hoisted(() => ({
    mockService: {
        getShippingAddresses: vi.fn(),
        createShippingAddress: vi.fn(),
        deleteShippingAddress: vi.fn(),
        setDefaultShippingAddress: vi.fn(),
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
        const { items, defaultAddress, fetchAll } = useShippingAddresses({ customerId: 'cust_1' });

        await fetchAll();

        expect(items.value.map(({ id }) => id)).toEqual(['shad_default', 'shad_new', 'shad_old']);
        expect(defaultAddress.value?.id).toBe('shad_default');
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

    it('has no default while none is marked as one', async () => {
        mockService.getShippingAddresses.mockResolvedValue({ data: [address()] });
        const { defaultAddress, fetchAll } = useShippingAddresses({ customerId: 'cust_1' });

        await fetchAll();

        expect(defaultAddress.value).toBeUndefined();
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

    // Setting a default clears the previous one, so the list is read again rather than patched.
    it.each([
        ['stores an address', 'create', 'createShippingAddress'],
        ['deletes an address', 'remove', 'deleteShippingAddress'],
        ['sets the default', 'setDefault', 'setDefaultShippingAddress'],
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

    it('deletes and sets the default by the address id', async () => {
        const addresses = useShippingAddresses({ customerId: 'cust_1' });

        await addresses.remove(address({ id: 'shad_9' }));
        await addresses.setDefault(address({ id: 'shad_9' }));

        expect(mockService.deleteShippingAddress).toHaveBeenCalledWith({
            shippingAddressId: 'shad_9',
        });
        expect(mockService.setDefaultShippingAddress).toHaveBeenCalledWith({
            shippingAddressId: 'shad_9',
        });
    });

    describe('replacing an address', () => {
        const payload = { customer_id: 'cust_1', reference: 'ref_new' } as never;
        const stored = address({ id: 'shad_new', status: 'ACTIVE' });

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
            expect(mockService.setDefaultShippingAddress).not.toHaveBeenCalled();
            expect(mockService.getShippingAddresses).toHaveBeenCalledTimes(1);
        });

        it('moves the default to the new address before the old one is retired', async () => {
            const addresses = useShippingAddresses({ customerId: 'cust_1' });

            await addresses.replace(address({ id: 'shad_old', is_default: true }), payload, {});

            expect(mockService.setDefaultShippingAddress).toHaveBeenCalledWith({
                shippingAddressId: 'shad_new',
            });
            expect(mockService.createShippingAddress.mock.invocationCallOrder[0]).toBeLessThan(
                mockService.setDefaultShippingAddress.mock.invocationCallOrder[0],
            );
            expect(mockService.setDefaultShippingAddress.mock.invocationCallOrder[0]).toBeLessThan(
                mockService.deleteShippingAddress.mock.invocationCallOrder[0],
            );
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

        it('carries on from the stored replacement when a later step failed', async () => {
            mockService.setDefaultShippingAddress.mockRejectedValueOnce(new Error('nope'));
            const addresses = useShippingAddresses({ customerId: 'cust_1' });
            const progress = {};
            const old = address({ id: 'shad_old', is_default: true });

            await expect(addresses.replace(old, payload, progress)).rejects.toThrow('nope');
            expect(progress).toEqual({ replacement: stored });
            expect(mockService.deleteShippingAddress).not.toHaveBeenCalled();

            await addresses.replace(old, payload, progress);

            expect(mockService.createShippingAddress).toHaveBeenCalledTimes(1);
            expect(mockService.setDefaultShippingAddress).toHaveBeenCalledTimes(2);
            expect(mockService.deleteShippingAddress).toHaveBeenCalledWith({
                shippingAddressId: 'shad_old',
            });
        });

        it('does not move the default twice when only the retiring failed', async () => {
            mockService.deleteShippingAddress.mockRejectedValueOnce(new Error('nope'));
            const addresses = useShippingAddresses({ customerId: 'cust_1' });
            const progress = {};
            const old = address({ id: 'shad_old', is_default: true });

            await expect(addresses.replace(old, payload, progress)).rejects.toThrow('nope');
            await addresses.replace(old, payload, progress);

            expect(mockService.setDefaultShippingAddress).toHaveBeenCalledTimes(1);
            expect(mockService.deleteShippingAddress).toHaveBeenCalledTimes(2);
        });
    });
});
