import { ShippingAddressNotActivatedError, useShippingAddresses } from './useShippingAddresses';
import type { ShippingAddress } from '@/types/shippingAddress';

const { mockService, mockLoggerError } = vi.hoisted(() => ({
    mockService: {
        getShippingAddresses: vi.fn(),
        createShippingAddress: vi.fn(),
        updateShippingAddress: vi.fn(),
        activateShippingAddress: vi.fn(),
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
        ['edits an address', 'update', 'updateShippingAddress'],
        ['deletes an address', 'remove', 'deleteShippingAddress'],
        ['sets the default', 'setDefault', 'setDefaultShippingAddress'],
    ] as const)('reloads the list once it %s', async (_, action, serviceCall) => {
        mockService[serviceCall].mockResolvedValue(address());
        const addresses = useShippingAddresses({ customerId: 'cust_1' });

        if (action === 'create') {
            await addresses.create({ customer_id: 'cust_1' } as never);
        } else if (action === 'update') {
            await addresses.update(address(), { reference: 'ref_1' } as never);
        } else {
            await addresses[action](address());
        }

        expect(mockService[serviceCall]).toHaveBeenCalled();
        expect(mockService.getShippingAddresses).toHaveBeenCalledTimes(1);
    });

    it('activates a new address the API stored as a draft', async () => {
        const active = address({ id: 'shad_new', status: 'ACTIVE' });
        mockService.createShippingAddress.mockResolvedValue(
            address({ id: 'shad_new', status: 'DRAFT' }),
        );
        mockService.activateShippingAddress.mockResolvedValue(active);
        const addresses = useShippingAddresses({ customerId: 'cust_1' });

        const created = await addresses.create({ customer_id: 'cust_1' } as never);

        expect(mockService.activateShippingAddress).toHaveBeenCalledWith({
            shippingAddressId: 'shad_new',
        });
        expect(created).toBe(active);
        expect(mockService.getShippingAddresses).toHaveBeenCalledTimes(1);
    });

    it('does not activate a new address that is active already', async () => {
        mockService.createShippingAddress.mockResolvedValue(address({ status: 'ACTIVE' }));
        const addresses = useShippingAddresses({ customerId: 'cust_1' });

        await addresses.create({ customer_id: 'cust_1' } as never);

        expect(mockService.activateShippingAddress).not.toHaveBeenCalled();
    });

    it('hands back the stored draft when the activation fails, and still reloads', async () => {
        const failure = new Error('nope');
        const stored = address({ id: 'shad_new', status: 'DRAFT' });
        mockService.createShippingAddress.mockResolvedValue(stored);
        mockService.activateShippingAddress.mockRejectedValue(failure);
        const addresses = useShippingAddresses({ customerId: 'cust_1' });

        const error = await addresses.create({ customer_id: 'cust_1' } as never).catch((e) => e);

        expect(error).toBeInstanceOf(ShippingAddressNotActivatedError);
        expect(error.address).toBe(stored);
        expect(error.cause).toBe(failure);
        expect(mockService.getShippingAddresses).toHaveBeenCalledTimes(1);
    });

    it('saves onto a draft it is given and activates it, rather than storing another', async () => {
        const stored = address({ id: 'shad_new', status: 'DRAFT' });
        const payload = { customer_id: 'cust_1', reference: 'ref_new' } as never;
        mockService.updateShippingAddress.mockResolvedValue(stored);
        mockService.activateShippingAddress.mockResolvedValue(
            address({ id: 'shad_new', status: 'ACTIVE' }),
        );
        const addresses = useShippingAddresses({ customerId: 'cust_1' });

        await addresses.create(payload, stored);

        expect(mockService.createShippingAddress).not.toHaveBeenCalled();
        expect(mockService.updateShippingAddress).toHaveBeenCalledWith({
            shippingAddressId: 'shad_new',
            payload,
        });
        expect(mockService.activateShippingAddress).toHaveBeenCalledWith({
            shippingAddressId: 'shad_new',
        });
    });

    it('leaves the status of an edited address alone', async () => {
        const addresses = useShippingAddresses({ customerId: 'cust_1' });

        await addresses.update(address({ id: 'shad_9' }), { reference: 'ref_9' } as never);

        expect(mockService.updateShippingAddress).toHaveBeenCalledWith({
            shippingAddressId: 'shad_9',
            payload: { reference: 'ref_9' },
        });
    });

    it('edits, deletes and sets the default by the address id', async () => {
        const addresses = useShippingAddresses({ customerId: 'cust_1' });
        const payload = { reference: 'ref_9' } as never;

        await addresses.update(address({ id: 'shad_9' }), payload);

        await addresses.remove(address({ id: 'shad_9' }));
        await addresses.setDefault(address({ id: 'shad_9' }));

        expect(mockService.updateShippingAddress).toHaveBeenCalledWith({
            shippingAddressId: 'shad_9',
            payload,
        });
        expect(mockService.deleteShippingAddress).toHaveBeenCalledWith({
            shippingAddressId: 'shad_9',
        });
        expect(mockService.setDefaultShippingAddress).toHaveBeenCalledWith({
            shippingAddressId: 'shad_9',
        });
    });
});
