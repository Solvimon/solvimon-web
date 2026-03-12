export type RequestAction = (detail: ActionRequestDetail, originalEvent?: Event) => boolean;

export type ActionRequestDetailBase = {
    action: string;
    entity?: string;
    data?: Record<string, unknown>;
    href?: string;
    meta?: Record<string, unknown>;
};

export interface ActionRequestDetailViewInvoice extends ActionRequestDetailBase {
    action: 'view-invoice';
    data: { invoiceId: string };
}

export interface ActionRequestDetailPayInvoice extends ActionRequestDetailBase {
    action: 'pay-invoice';
    data: { invoiceId: string };
}

export interface ActionRequestDetailViewSubscriptionDetails extends ActionRequestDetailBase {
    action: 'view-subscription-details';
    data: { subscriptionId: string };
}

export interface ActionRequestDetailViewAllSubscriptions extends ActionRequestDetailBase {
    action: 'view-all-subscriptions';
}

export interface ActionRequestDetailCancelSubscription extends ActionRequestDetailBase {
    action: 'cancel-subscription';
    data: { subscriptionId: string };
}

export interface ActionRequestDetailRenewSubscription extends ActionRequestDetailBase {
    action: 'renew-subscription';
    data: { subscriptionId: string };
}

export interface ActionRequestDetailViewAllPaymentMethods extends ActionRequestDetailBase {
    action: 'view-all-payment-methods';
}

export interface ActionRequestDetailAddPaymentMethod extends ActionRequestDetailBase {
    action: 'add-payment-method';
}

export interface ActionRequestDetailEditBillingInformation extends ActionRequestDetailBase {
    action: 'edit-billing-information';
}

export type ActionRequestDetail =
    | ActionRequestDetailViewInvoice
    | ActionRequestDetailPayInvoice
    | ActionRequestDetailViewSubscriptionDetails
    | ActionRequestDetailViewAllSubscriptions
    | ActionRequestDetailCancelSubscription
    | ActionRequestDetailRenewSubscription
    | ActionRequestDetailViewAllPaymentMethods
    | ActionRequestDetailAddPaymentMethod
    | ActionRequestDetailEditBillingInformation;

export type RequestActionEvent = CustomEvent<RequestAction>;
