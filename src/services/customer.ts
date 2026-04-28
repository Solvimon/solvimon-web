import type { Customer } from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

interface CustomerService {
    getCustomer: (customerId: Customer['id']) => Promise<Customer>;
    updateCustomer: (customerId: Customer['id'], payload: Partial<Customer>) => Promise<Customer>;
}

export function createCustomerService(): CustomerService {
    const request = createRequestService();
    const config = useConfig();

    function getCustomer(customerId: Customer['id']): Promise<Customer> {
        return request<Customer>({
            url: `${config.apiUrls.config}/portal/customers/${customerId}`,
        });
    }

    function updateCustomer(customerId: Customer['id'], payload: Partial<Customer>) {
        return request<Customer>({
            url: `${config.apiUrls.config}/portal/customers/${customerId}`,
            options: { method: 'PATCH' },
            data: payload,
        });
    }

    return {
        getCustomer,
        updateCustomer,
    };
}
