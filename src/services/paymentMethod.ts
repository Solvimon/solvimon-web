import { PaymentMethodOptions, PaymentMethodTokenizeActionRequiredAdyenResponse, PaymentMethodTokenizeActionRequiredResponse, PaymentMethodTokenizeActionRequiredStripeResponse, PaymentMethodTokenizeAdyenPayload, PaymentMethodTokenizePayload, PaymentMethodTokenizeStripePayload, PaymentMethodTokenizeSuccessResponse } from "@solvimon/types";
import { useConfig } from "../components/ConfigProvider/composables/useConfig";
import { request} from "../utils/request";


export function getPaymentMethodOptions({ customerId }: { customerId: string }) {
    const config = useConfig();

    return request<PaymentMethodOptions>({ 
        endpoint:  `${config.apiUrls.config}/portal/payment-method-options?customer_id=${customerId}`, 
    });
};

export function tokenizePaymentMethod(data: PaymentMethodTokenizeAdyenPayload): Promise<PaymentMethodTokenizeSuccessResponse | PaymentMethodTokenizeActionRequiredAdyenResponse>
export function tokenizePaymentMethod(data: PaymentMethodTokenizeStripePayload): Promise<PaymentMethodTokenizeSuccessResponse | PaymentMethodTokenizeActionRequiredStripeResponse>
export function tokenizePaymentMethod(data: PaymentMethodTokenizePayload): Promise<PaymentMethodTokenizeSuccessResponse|PaymentMethodTokenizeActionRequiredResponse> {
    const config = useConfig();

    return  request<PaymentMethodTokenizeActionRequiredResponse>({
        endpoint: `${config.apiUrls.config}/portal/payment-methods/tokenize`,
        options: { method: 'POST' },
        data
    })
}