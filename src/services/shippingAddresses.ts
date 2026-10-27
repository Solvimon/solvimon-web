import type { ApiSuccessCollectionResponse, Customer } from '@solvimon/solvimon-types';
import { withPagination } from '@solvimon/solvimon-ui';
import { createRequestService } from './requests';
import { buildUrl } from './requests.lib';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import type { CreateShippingAddressPayload, ShippingAddress } from '@/types/shippingAddress';

/** The most addresses one customer is expected to keep; the list asks for them in one page. */
const PAGE_SIZE = 50;

export interface ShippingAddressesService {
    getShippingAddresses(args: {
        customerId: Customer['id'];
    }): Promise<ApiSuccessCollectionResponse<ShippingAddress>>;
    createShippingAddress(payload: CreateShippingAddressPayload): Promise<ShippingAddress>;
    updateShippingAddress(args: {
        shippingAddressId: ShippingAddress['id'];
        payload: CreateShippingAddressPayload;
    }): Promise<ShippingAddress>;
    deleteShippingAddress(args: {
        shippingAddressId: ShippingAddress['id'];
    }): Promise<ShippingAddress>;
}

export function createShippingAddressesService(): ShippingAddressesService {
    const request = createRequestService();
    const config = useConfig();
    const BASE_PATH = ['portal', 'shipping-addresses'];

    /** GET /v1/portal/shipping-addresses — the customer's addresses, the retired ones left out. */
    function getShippingAddresses({
        customerId,
    }: {
        customerId: Customer['id'];
    }): Promise<ApiSuccessCollectionResponse<ShippingAddress>> {
        return request<ShippingAddress>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH),
            query: withPagination(
                { customer_id: customerId, statuses: ['ACTIVE'] },
                { page: 1, pageSize: PAGE_SIZE },
            ),
            isCollection: true,
        });
    }

    /** POST /v1/portal/shipping-addresses */
    function createShippingAddress(
        payload: CreateShippingAddressPayload,
    ): Promise<ShippingAddress> {
        return request<ShippingAddress>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH),
            data: payload,
            options: { method: 'POST' },
        });
    }

    /** PATCH /v1/portal/shipping-addresses/{id} */
    function updateShippingAddress({
        shippingAddressId,
        payload,
    }: {
        shippingAddressId: ShippingAddress['id'];
        payload: CreateShippingAddressPayload;
    }): Promise<ShippingAddress> {
        return request<ShippingAddress>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH, shippingAddressId),
            data: payload,
            options: { method: 'PATCH' },
        });
    }

    /**
     * POST /v1/portal/shipping-addresses/{id}/deprecate
     *
     * Deleting an address retires it: the portal has no DELETE, and a subscription that ships to
     * it has to keep pointing at something.
     */
    function deleteShippingAddress({
        shippingAddressId,
    }: {
        shippingAddressId: ShippingAddress['id'];
    }): Promise<ShippingAddress> {
        return request<ShippingAddress>({
            url: buildUrl(config.apiUrls.config, ...BASE_PATH, shippingAddressId, 'deprecate'),
            options: { method: 'POST' },
        });
    }

    return {
        getShippingAddresses,
        createShippingAddress,
        updateShippingAddress,
        deleteShippingAddress,
    };
}
