/**
 * Stands in for Stripe.js.
 *
 * The Adyen integration is bundled into the SDK and draws its card fields from Adyen's own hosts
 * over a private postMessage protocol, so there is no seam a test can stand in at — its behaviour
 * is covered by `PaymentIntegrationFormAdyen.spec.ts`. Stripe is loaded over the network from a
 * URL the SDK names (`PaymentIntegrationFormStripe.constants.ts`) and is driven through a small,
 * public API, so serving this in its place gives the suite a payment gateway it can steer while
 * leaving the SDK's own code — the iframe, the postMessage bridge, the authorize call — real.
 *
 * Only what the SDK calls is implemented: `elements`, `elements.submit`,
 * `createConfirmationToken` and `handleNextAction`.
 */

export interface StripeStubConfig {
    /** The id handed back to the SDK, which posts it on to `/payments/authorize`. */
    confirmationTokenId: string;
    /** Makes `elements.submit()` fail, as it does when a card field is incomplete. */
    submitError?: { message: string; code?: string; type?: string };
    /** Makes tokenization fail, as it does when the card is rejected up front. */
    confirmationTokenError?: { message: string; code?: string; type?: string };
    /** Makes the 3DS step fail after an ACTION_REQUIRED authorization. */
    nextActionError?: { message: string; code?: string; type?: string };
    /** Makes the payment element report that it could not load at all. */
    loadError?: { message: string; type?: string };
}

export function stripeStubScript(config: StripeStubConfig): string {
    return `
(function () {
    var config = ${JSON.stringify(config)};

    function createPaymentElement() {
        var handlers = {};

        return {
            on: function (event, handler) {
                handlers[event] = handler;
            },
            mount: function (selector) {
                var root = document.querySelector(selector);

                // Stands in for the card fields, so a test can see the form and type into it.
                root.innerHTML =
                    '<div data-testid="stripe-payment-element">' +
                    '<label>Card number<input data-testid="stripe-card-number" /></label>' +
                    '</div>';

                setTimeout(function () {
                    if (config.loadError && handlers.loaderror) {
                        handlers.loaderror({ error: config.loadError });
                        return;
                    }

                    if (handlers.ready) handlers.ready();
                    if (handlers.change) handlers.change({ value: { type: 'card' } });
                }, 0);
            },
            unmount: function () {},
            destroy: function () {},
        };
    }

    window.Stripe = function () {
        return {
            elements: function () {
                return {
                    create: createPaymentElement,
                    submit: function () {
                        return Promise.resolve(
                            config.submitError ? { error: config.submitError } : {},
                        );
                    },
                };
            },
            createConfirmationToken: function () {
                return Promise.resolve(
                    config.confirmationTokenError
                        ? { error: config.confirmationTokenError }
                        : { confirmationToken: { id: config.confirmationTokenId } },
                );
            },
            handleNextAction: function () {
                return Promise.resolve(
                    config.nextActionError ? { error: config.nextActionError } : {},
                );
            },
        };
    };
})();
`;
}
