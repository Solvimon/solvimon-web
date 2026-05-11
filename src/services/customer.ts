import type { Customer, TaxIdValidationResult, TaxIdentifier, CountryCode } from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

interface TaxIdValidationResponse {
    data: TaxIdValidationResult[];
}

interface CheckTaxIDPayload {
    type: 'ORGANIZATION';
    organization: {
        legal_name: string;
        tax_ids: TaxIdentifier[];
        registered_address: {
            country: CountryCode;
        };
    };
}

interface CustomerService {
    getCustomer: (customerId: Customer['id']) => Promise<Customer>;
    updateCustomer: (customerId: Customer['id'], payload: Partial<Customer>) => Promise<Customer>;
    checkTaxID: (payload: CheckTaxIDPayload) => Promise<TaxIdValidationResponse>;
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

    function checkTaxID(payload: CheckTaxIDPayload) {
        return request<TaxIdValidationResponse>({
            url: `${config.apiUrls.config}/portal/customers/validate-tax-id`,
            options: { method: 'POST' },
            data: payload,
        });
    }

    return {
        getCustomer,
        updateCustomer,
        checkTaxID,
    };
}
