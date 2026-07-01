export type EntryKind = 'screen' | 'component';

export interface StoryEntry {
    kind: EntryKind;
    id: string;
    label: string;
    description: string;
    /** JSON shown in the configuration editor by default */
    defaultConfiguration?: Record<string, unknown>;
}

export const screens: StoryEntry[] = [
    {
        kind: 'screen',
        id: 'checkout',
        label: 'Checkout',
        description: 'Full checkout flow. Requires a CheckoutPagePortalUrl.',
    },
    {
        kind: 'screen',
        id: 'customer-overview',
        label: 'Customer Overview',
        description: "Overview of a customer's billing information, subscriptions, invoices, and payment methods.",
    },
    {
        kind: 'screen',
        id: 'upgrade-subscription',
        label: 'Upgrade Subscription',
        description: 'Upgrade or change a customer subscription plan.',
        defaultConfiguration: { subscriptionId: '' },
    },
    {
        kind: 'screen',
        id: 'pay-invoice',
        label: 'Pay Invoice',
        description: 'Payment flow for a specific invoice. Requires configuration.invoiceId.',
        defaultConfiguration: { invoiceId: '' },
    },
];

export const components: StoryEntry[] = [
    {
        kind: 'component',
        id: 'billing-information',
        label: 'Billing Information',
        description: 'Displays customer billing information (read-only).',
    },
    {
        kind: 'component',
        id: 'billing-information-form',
        label: 'Billing Information Form',
        description: 'Editable form for updating customer billing details.',
    },
    {
        kind: 'component',
        id: 'customer-payment-methods',
        label: 'Customer Payment Methods',
        description: 'Lists and manages saved payment methods for a customer.',
    },
    {
        kind: 'component',
        id: 'invoice',
        label: 'Invoice',
        description: 'Displays a single invoice. Requires configuration.invoiceId.',
        defaultConfiguration: { invoiceId: '' },
    },
    {
        kind: 'component',
        id: 'invoice-header',
        label: 'Invoice Header',
        description: 'Displays the header section of a single invoice. Requires configuration.invoiceId.',
        defaultConfiguration: { invoiceId: '' },
    },
    {
        kind: 'component',
        id: 'invoice-details',
        label: 'Invoice Details',
        description: 'Detailed view of a single invoice. Requires configuration.invoiceId.',
        defaultConfiguration: { invoiceId: '' },
    },
    {
        kind: 'component',
        id: 'invoices-list',
        label: 'Invoices List',
        description: 'Lists all invoices for a customer.',
    },
    {
        kind: 'component',
        id: 'payment-history',
        label: 'Payment History',
        description: 'Payment attempts for a specific invoice. Requires configuration.invoiceId.',
        defaultConfiguration: { invoiceId: '' },
    },
    {
        kind: 'component',
        id: 'payment-method-form',
        label: 'Payment Method Form',
        description: 'Form to add or tokenize a payment method.',
        defaultConfiguration: { variant: 'TOKENIZE' },
    },
    {
        kind: 'component',
        id: 'subscription-schedules',
        label: 'Subscription Schedules',
        description: 'Scheduled changes for a subscription. Requires configuration.subscriptionId.',
        defaultConfiguration: { subscriptionId: '' },
    },
    {
        kind: 'component',
        id: 'subscriptions-list',
        label: 'Subscriptions List',
        description: 'Lists all subscriptions for a customer.',
    },
    {
        kind: 'component',
        id: 'wallet-balances',
        label: 'Wallet Balances',
        description: 'Displays wallet balance information for a customer.',
    },
];

export const allEntries = [...screens, ...components];
