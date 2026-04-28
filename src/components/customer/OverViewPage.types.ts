import type {
    Customer,
    Invoice,
    PaymentMethod,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

export type BlockConfig<T> = {
    show: boolean;
    data: T[];
    showMoreLink: boolean;
};

export interface OverviewPageProps {
    invoice: BlockConfig<Invoice>;
    subscriptions: BlockConfig<PricingPlanSubscriptionExpanded>;
    paymentMethods: BlockConfig<PaymentMethod>;
    paymentMethodOptions?: PaymentMethodOptionsResponse;
    billingInformation: {
        show: boolean;
        data?: Customer;
    };
}
