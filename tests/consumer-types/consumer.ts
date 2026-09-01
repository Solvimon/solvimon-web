import { createSolvimonCore, getRegisteredComponentIds } from '@solvimon/solvimon-web/core';
import type {
    Amount,
    ComponentConfigurationById,
    CountryCode,
    CustomerPortalUrl,
    Environment,
    IntlMessages,
    LogEntry,
    PlatformBranding,
    PortalUrl,
    ScreenConfigurationById,
} from '@solvimon/solvimon-web/core';
import { defineSolvimonInvoicesList } from '@solvimon/solvimon-web/components/invoices-list';

declare const portalObject: CustomerPortalUrl;

/* The types a host writes against resolve to something real, not `any`. */
export const environment: Environment = 'TEST';
export const branding: PlatformBranding = { colors: { primary: '#0066cc' } };
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
};

// @ts-expect-error - only the Solvimon environments are accepted
export const notAnEnvironment: Environment = 'PRODUCTION';
// @ts-expect-error - DEV and BETA are internal, and are stripped from the published build
export const notAPublishedEnvironment: Environment = 'DEV';
// @ts-expect-error - only ISO 3166-1 alpha-2 codes are accepted
export const notACountry: CountryCode = 'Netherlands';
export const brandingColour: PlatformBranding = {
    // @ts-expect-error - brand colours are strings
    colors: { primary: 0x0066cc },
};

/* The custom element entry points export one define function, and it takes an optional tag name. */
export const defineInvoicesList = defineSolvimonInvoicesList;
defineSolvimonInvoicesList();
defineSolvimonInvoicesList('acme-invoices-list');
export const componentIds: string[] = getRegisteredComponentIds();

const core = createSolvimonCore({ environment, locale: 'en-US', branding, messages });

/* Documented usage compiles. */
export const unmountList = core.createComponent('invoices-list', {
    container: '#invoices',
    portalObject,
    configuration: { showPayButton: false, pagination: { batchSize: 20 } },
});

/* A screen with no configuration of its own. */
export const unmountOverview = core.createScreen('customer-overview', {
    container: '#overview',
    portalObject,
});

/* Every option a configuration leaves out keeps its default, so a partial object is valid. */
export const unmountPartial = core.createComponent('invoices-list', {
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
