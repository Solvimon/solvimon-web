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
 * Only what the SDK calls is implemented: `elements`, `elements.submit`, `elements.update`,
 * `createConfirmationToken`, `handleNextAction` and `retrievePaymentIntent`.
 */

export interface StripeStubConfig {
    /** The id handed back to the SDK, which posts it on to `/payments/authorize`. */
    confirmationTokenId: string;
    /** Makes `elements.submit()` fail, as it does when a card field is incomplete. */
    submitError?: { message: string; code?: string; type?: string };
    /** Makes `elements.submit()` reject outright instead of answering with an error. */
    submitRejection?: string;
    /** Makes tokenization fail, as it does when the card is rejected up front. */
    confirmationTokenError?: { message: string; code?: string; type?: string };
    /** Makes the 3DS step fail after an ACTION_REQUIRED authorization. */
    nextActionError?: { message: string; code?: string; type?: string };
    /**
     * The status Stripe reports for the payment, after a further step or on return from a
     * redirect. `succeeded` unless a test says otherwise.
     */
    intentStatus?: string;
    /** Makes retrieving the payment fail, as it does when Stripe cannot be reached. */
    retrieveError?: { message: string; code?: string; type?: string };
    /** Makes the payment element report that it could not load at all. */
    loadError?: { message: string; type?: string };
}

export function stripeStubScript(config: StripeStubConfig): string {
    return `
(function () {
    var config = ${JSON.stringify(config)};

    /** Records on the page the frame belongs to, which is the only place a test can read. */
    function record(key, value) {
        try {
            var top = window.parent || window;
            top[key] = (top[key] || []).concat([value]);
        } catch (error) {
            // A frame that cannot see its parent records nothing, which is not a failure.
        }
    }

    function createPaymentElement() {
        var handlers = {};
        var node;

        return {
            on: function (event, handler) {
                handlers[event] = handler;
            },
            mount: function (selector) {
                // Added beside whatever is there, as Stripe adds its own frame, so an element
                // mounted twice shows twice.
                node = document.createElement('div');
                node.setAttribute('data-testid', 'stripe-payment-element');
                node.innerHTML =
                    '<label>Card number<input data-testid="stripe-card-number" /></label>';
                document.querySelector(selector).appendChild(node);

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
            destroy: function () {
                if (node) node.remove();
            },
        };
    }

    window.Stripe = function () {
        return {
            elements: function (options) {
                // The options are what the SDK asks Stripe for — whether to keep the method
                // among them.
                record('__STRIPE_STUB_ELEMENTS__', options);

                return {
                    create: createPaymentElement,
                    update: function (update) {
                        record('__STRIPE_STUB_UPDATES__', update);
                        return Promise.resolve();
                    },
                    submit: function () {
                        if (config.submitRejection) {
                            return Promise.reject(new Error(config.submitRejection));
                        }
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
                    config.nextActionError
                        ? { error: config.nextActionError }
                        : { paymentIntent: { status: config.intentStatus || 'succeeded' } },
                );
            },
            retrievePaymentIntent: function () {
                window.__STRIPE_STUB_RETRIEVALS__ = (window.__STRIPE_STUB_RETRIEVALS__ || 0) + 1;
                return Promise.resolve(
                    config.retrieveError
                        ? { error: config.retrieveError }
                        : { paymentIntent: { status: config.intentStatus || 'succeeded' } },
                );
            },
        };
    };
})();
`;
}
