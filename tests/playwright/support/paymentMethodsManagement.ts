import type { Page } from '@playwright/test';
import type { ApiMock, EndpointName, Responder } from './api-mock';
import { mountScreen, sharedMocks, type ScreenOptions } from './screen';
import {
    aCustomer,
    aCustomerPortalObject,
    aPaymentMethod,
    collection,
    paymentMethodOptions,
    type Json,
} from './fixtures';

export interface MountOptions extends ScreenOptions {
    /** The methods the customer already has; defaults to one default card. */
    paymentMethods?: Json[];
    gateways?: ('STRIPE' | 'ADYEN')[];
}

function defaultMocks(options: MountOptions): Partial<Record<EndpointName, Responder>> {
    return {
        ...sharedMocks,
        customer: { body: aCustomer() },
        paymentMethods: {
            body: collection(options.paymentMethods ?? [aPaymentMethod({ isDefault: true })]),
        },
        paymentMethodOptions: { body: paymentMethodOptions({ gateways: options.gateways }) },
    };
}

export function mountPaymentMethodsManagement(
    page: Page,
    options: MountOptions = {},
): Promise<ApiMock> {
    return mountScreen(
        page,
        'payment-methods-management',
        { ...options, portalObject: options.portalObject ?? aCustomerPortalObject() },
        defaultMocks(options),
    );
}

export function paymentMethodsManagement(page: Page) {
    return {
        list: page.locator('.sv-payment-methods__list'),
        items: page.locator('.sv-payment-methods__item'),
        addButton: page.getByRole('button', { name: /add payment method/i }),
        cancelButton: page.getByRole('button', { name: /^cancel$/i }),
        /** The per-method menu, which is an icon button with no text of its own. */
        menuFor: (index: number) =>
            page.locator('.sv-payment-methods__item').nth(index).getByRole('button'),
        form: page.locator('.sv-payment-method-form'),
        submit: page.locator('.sv-payment-method-form').getByRole('button').last(),
        deleteModal: page.locator('.sv-payment-methods__delete-modal-body'),
        /** The modal's own footer button, which sits outside the body it confirms. */
        confirmDelete: page.getByRole('button', { name: /^delete$/i }).last(),
        deleteModalError: page.locator('.sv-payment-methods__delete-modal-error'),
        stripeElement: page
            .frameLocator('iframe')
            .locator('[data-testid="stripe-payment-element"]'),
    };
}

export { hostEvents } from './screen';
