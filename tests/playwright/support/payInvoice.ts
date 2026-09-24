import type { Page } from '@playwright/test';
import type { ApiMock, EndpointName, Responder } from './api-mock';
import { mountScreen, sharedMocks, type ScreenOptions } from './screen';
import {
    aCustomer,
    aCustomerPortalObject,
    anInvoiceRecord,
    aPaymentMethod,
    collection,
    INVOICE_ID,
    paymentMethodOptions,
    type Json,
} from './fixtures';

export interface MountOptions extends ScreenOptions {
    /** The invoice being paid; defaults to an open one of €20.00. */
    invoice?: Json;
    /** Earlier attempts at this invoice, which the header reports. */
    payments?: Json[];
    gateways?: ('STRIPE' | 'ADYEN')[];
}

function defaultMocks(options: MountOptions): Partial<Record<EndpointName, Responder>> {
    return {
        ...sharedMocks,
        invoice: { body: options.invoice ?? anInvoiceRecord() },
        payments: { body: collection(options.payments ?? []) },
        paymentMethods: { body: collection([aPaymentMethod({ isDefault: true })]) },
        paymentMethodOptions: { body: paymentMethodOptions({ gateways: options.gateways }) },
        customer: { body: aCustomer() },
    };
}

export function mountPayInvoice(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    return mountScreen(
        page,
        'pay-invoice',
        {
            ...options,
            portalObject: options.portalObject ?? aCustomerPortalObject(),
            configuration: options.configuration ?? { invoiceId: INVOICE_ID },
        },
        defaultMocks(options),
    );
}

export function payInvoice(page: Page) {
    return {
        screen: page.locator('.sv-layout'),
        paid: page.getByText(/thank you for your payment/i),
        storePaymentMethod: page.getByText(/save this payment method/i),
        payButton: page.getByRole('button', { name: /^pay /i }),
        downloadInvoice: page.getByRole('button', { name: /download invoice/i }),
        stripeElement: page
            .frameLocator('iframe')
            .locator('[data-testid="stripe-payment-element"]'),
    };
}

export { hostEvents, stripeElementsOptions } from './screen';
