import { createSolvimonCore, getRegisteredComponentIds } from '@solvimon/solvimon-web/core';
import type {
    ActionRequestDetail,
    ActionRequestDetailPayInvoice,
    Amount,
    ComponentConfigurationById,
    CountryCode,
    CustomerPortalUrl,
    Environment,
    IntlMessages,
    LogEntry,
    PlatformBranding,
    SolvimonBranding,
    SolvimonErrorEvent,
    PortalUrl,
    ExperimentalFeature,
    ScreenConfigurationById,
} from '@solvimon/solvimon-web/core';
import { defineSolvimonInvoicesList } from '@solvimon/solvimon-web/components/invoices-list';
import { defineSolvimonInvoiceHeader } from '@solvimon/solvimon-web/components/invoice-header';
import { defineSolvimonPaymentMethodsManagement } from '@solvimon/solvimon-web/screens/payment-methods-management';

declare const portalObject: CustomerPortalUrl;

/* The types a host writes against resolve to something real, not `any`. */
export const environment: Environment = 'TEST';
export const branding: SolvimonBranding = { colors: { primary: '#0066cc' } };
/* An emblem needs only its URL, and the branding the API returns can be passed on as it is. */
export const emblemOnly: SolvimonBranding = { emblem: { public_url: 'https://cdn.example/e.png' } };
declare const fromApi: PlatformBranding;
export const passedOn: SolvimonBranding = fromApi;
/* The API returns null for an unset colour or emblem URL. */
export const withNulls: SolvimonBranding = {
    colors: { primary: null, secondary: '#004499' },
    emblem: { public_url: null },
};
export const messages: IntlMessages = { 'invoices_list.title': 'Bills' };
export const country: CountryCode = 'NL';
export const amount: Amount = { quantity: '1000', currency: 'EUR' };
export const anyPortal: PortalUrl = portalObject;
export const log: LogEntry = {
    schemaVersion: 1,
    level: 'warn',
    code: 'TRANSLATION_LOAD_FAILED',
    message: 'a message',
    timestamp: '2026-01-01T00:00:00.000Z',
    reference: 'SV-7F3K2A9Q',
};

// @ts-expect-error - only the Solvimon environments are accepted
export const notAnEnvironment: Environment = 'PRODUCTION';
// @ts-expect-error - DEV and BETA are internal, and are stripped from the published build
export const notAPublishedEnvironment: Environment = 'DEV';
// @ts-expect-error - only ISO 3166-1 alpha-2 codes are accepted
export const notACountry: CountryCode = 'Netherlands';
export const brandingColour: SolvimonBranding = {
    // @ts-expect-error - brand colours are strings
    colors: { primary: 0x0066cc },
};

/* Everything the registry can mount has a subpath a consumer can import, and each entry exports one
   define function, which takes an optional tag name. */
export const defineInvoicesList = defineSolvimonInvoicesList;
export const defineInvoiceHeader = defineSolvimonInvoiceHeader;
export const definePaymentMethodsManagement = defineSolvimonPaymentMethodsManagement;
defineSolvimonInvoicesList();
defineSolvimonInvoicesList('acme-invoices-list');

/* `experimentalFeatures` names a real union rather than accepting anything. */
export const features: ExperimentalFeature[] = ['express-checkout'];
// @ts-expect-error - not an experimental feature the SDK knows about
export const notAFeature: ExperimentalFeature[] = ['teleportation'];
export const componentIds: string[] = getRegisteredComponentIds();

const core = createSolvimonCore({ environment, locale: 'en-US', branding, messages });

// @ts-expect-error - a core needs the environment its portal objects belong to
createSolvimonCore({ locale: 'en-US' });
// @ts-expect-error - and so cannot be created without any configuration
createSolvimonCore();

/* Documented usage compiles. */
export const listInstance = core.createComponent('invoices-list', {
    container: '#invoices',
    portalObject,
    configuration: { showPayButton: false, pagination: { batchSize: 20 } },
});

/* A screen with no configuration of its own. */
export const overviewInstance = core.createScreen('customer-overview', {
    container: '#overview',
    portalObject,
});

/* A mount returns an instance whose unmount can be destructured. */
export const { unmount } = core.createScreen('customer-overview', {
    container: '#overview',
    portalObject,
});

// @ts-expect-error A mount returns an instance, not a function to call.
overviewInstance();

/* Every option a configuration leaves out keeps its default, so a partial object is valid. */
export const partialInstance = core.createComponent('invoices-list', {
    container: '#invoices',
    portalObject,
    configuration: { pagination: { enabled: false } },
});

core.createComponent('invoices-list', {
    container: '#invoices',
    portalObject,
    // @ts-expect-error - showPayButtn is a typo for showPayButton
    configuration: { showPayButtn: true },
});

core.createComponent('invoices-list', {
    container: '#invoices',
    portalObject,
    // @ts-expect-error - batchSze is a typo for batchSize
    configuration: { pagination: { batchSze: 20 } },
});

core.createComponent('billing-information', {
    container: '#billing',
    portalObject,
    // @ts-expect-error - showEditButtn is a typo for showEditButton
    configuration: { showEditButtn: false },
});

core.createComponent('customer-payment-methods', {
    container: '#payment-methods',
    portalObject,
    // @ts-expect-error - maxItems counts items, so it is a number
    configuration: { maxItems: 'three' },
});

core.createComponent('subscriptions-list', {
    container: '#subscriptions',
    portalObject,
    // @ts-expect-error - the subscriptions list has no maxItems
    configuration: { maxItems: 3 },
});

core.createComponent('invoice', {
    container: '#invoice',
    portalObject,
    // @ts-expect-error - an invoice id is a string
    configuration: { invoiceId: 42 },
});

core.createComponent('invoices-list', {
    container: '#invoices',
    // @ts-expect-error - a portal object is more than a customer id
    portalObject: { customer_id: 'cus_1' },
});

// @ts-expect-error - there is no component under this id
core.createComponent('not-a-component', { container: '#x', portalObject });

/* The per-id configuration maps stay usable on their own. */
export const listOptions: ComponentConfigurationById['invoices-list'] = { showViewButton: true };
export const checkoutOptions: ScreenConfigurationById['checkout'] = { countryCode: 'NL' };

export const listTypo: ComponentConfigurationById['invoices-list'] = {
    // @ts-expect-error - showPayButtn is a typo for showPayButton
    showPayButtn: true,
};

/* Each action's own detail type comes from the core subpath, and narrows the union. */
export const payInvoice = (
    detail: ActionRequestDetail,
): ActionRequestDetailPayInvoice | undefined =>
    detail.action === 'pay-invoice' ? detail : undefined;

/* A solvimon-error listener reads what failed, where, and the reference support finds it by. */
export const describeError = (event: SolvimonErrorEvent): string =>
    `${event.detail.componentName}: ${event.detail.code} (${event.detail.reference}) ${event.detail.error.message}`;

/* The SDK's events are in the element and document event maps, so listeners know their detail. */
declare const someContainer: HTMLElement;
someContainer.addEventListener('solvimon-error', (event) => {
    const failed: string = event.detail.componentName;
    void failed;
    // @ts-expect-error - the detail of solvimon-error has no such field
    void event.detail.unknownField;
});
document.addEventListener('solvimon-action-request', (event) => {
    if (event.detail.action === 'pay-invoice') {
        const invoiceId: string = event.detail.data.invoiceId;
        void invoiceId;
    }
});
