/**
 * Action-request event types for the 'action-request' custom event.
 * Kept in a separate file with no internal dependencies so dist/core declarations resolve for consumers.
 */

export interface ActionRequestDetailViewInvoice {
    action: 'view-invoice';
    data: { invoiceId: string };
}

export interface ActionRequestDetailPayInvoice {
    action: 'pay-invoice';
    data: { invoiceId: string };
}

export interface ActionRequestDetailViewSubscriptionDetails {
    action: 'view-subscription-details';
    data: { subscriptionId: string };
}

export interface ActionRequestDetailViewAllSubscriptions {
    action: 'view-all-subscriptions';
}

export interface ActionRequestDetailManageSubscription {
    action: 'manage-subscription';
    /**
     * `enabledPricingId` is the pricing the customer chose to change, when they came from one. Hand
     * it to `SubscriptionManagement` as `configuration.enabledPricingId` to open on its group.
     */
    data: { subscriptionId: string; enabledPricingId?: string };
}

export interface ActionRequestDetailEditBillingInformation {
    action: 'edit-billing-information';
}

export interface ActionRequestDetailViewAllPaymentMethods {
    action: 'view-all-payment-methods';
}

export interface ActionRequestDetailAddPaymentMethod {
    action: 'add-payment-method';
}

export interface ActionRequestDetailViewCustomerOverview {
    action: 'view-customer-overview';
}

export type ActionRequestDetail =
    | ActionRequestDetailViewInvoice
    | ActionRequestDetailPayInvoice
    | ActionRequestDetailViewSubscriptionDetails
    | ActionRequestDetailViewAllSubscriptions
    | ActionRequestDetailManageSubscription
    | ActionRequestDetailEditBillingInformation
    | ActionRequestDetailViewAllPaymentMethods
    | ActionRequestDetailAddPaymentMethod
    | ActionRequestDetailViewCustomerOverview;

/**
 * The `action-request` event. It bubbles and crosses the shadow root, so a listener on the document
 * or a container hears every element; call `preventDefault()` to say the host handled it.
 */
export type ActionRequestEvent = CustomEvent<ActionRequestDetail>;
