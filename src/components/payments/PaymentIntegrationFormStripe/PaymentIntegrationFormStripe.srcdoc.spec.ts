import { flushPromises } from '@vue/test-utils';
import { STRIPE_FRAME_SRCDOC } from './PaymentIntegrationFormStripe.srcdoc';
import { STRIPE_SCRIPT_URL } from './PaymentIntegrationFormStripe.constants';
import frameSource from './PaymentIntegrationFormStripeFrame.vue?raw';

const PARENT_ORIGIN = 'https://shop.example';

type Handler = (payload: unknown) => void;

const parseSrcdoc = () => new DOMParser().parseFromString(STRIPE_FRAME_SRCDOC, 'text/html');

const inlineScript = () => {
    const script = [...parseSrcdoc().querySelectorAll('script')].find((s) => !s.src);
    if (!script?.textContent) throw new Error('The srcdoc has no inline script');
    return script.textContent;
};

/**
 * Runs the frame's inline script against a stand-in window, parent and Stripe, so each test can
 * deliver messages to it and read what it posts back.
 */
function runFrame({
    submitResult = {},
    tokenResult = { confirmationToken: { id: 'ctoken_123' } },
}: {
    submitResult?: unknown;
    tokenResult?: unknown;
} = {}) {
    const parent = { postMessage: vi.fn() };
    const paymentElementHandlers: Record<string, Handler> = {};
    const paymentElement = {
        on: vi.fn((event: string, handler: Handler) => {
            paymentElementHandlers[event] = handler;
        }),
        mount: vi.fn(),
    };
    const elements = {
        create: vi.fn(() => paymentElement),
        submit: vi.fn(() => Promise.resolve(submitResult)),
    };
    const stripe = {
        elements: vi.fn(() => elements),
        createConfirmationToken: vi.fn(() => Promise.resolve(tokenResult)),
    };
    const Stripe = vi.fn(() => stripe);

    let resizeCallback: (() => void) | undefined;
    const observe = vi.fn();
    const ResizeObserver = vi.fn(function (callback: () => void) {
        resizeCallback = callback;
        return { observe };
    });
    const document = { documentElement: { scrollHeight: 412 } };

    let onMessage: ((event: unknown) => void) | undefined;
    const window = {
        parent,
        addEventListener: (type: string, listener: (event: unknown) => void) => {
            if (type === 'message') onMessage = listener;
        },
    };

    // The script reads these as globals; passing them as parameters scopes them to this run.
    new Function('window', 'parent', 'Stripe', 'ResizeObserver', 'document', inlineScript())(
        window,
        parent,
        Stripe,
        ResizeObserver,
        document,
    );

    const send = (data: unknown, { source = parent as unknown, origin = PARENT_ORIGIN } = {}) =>
        onMessage?.({ data, source, origin });

    const init = (overrides: Record<string, unknown> = {}) =>
        send({
            type: 'stripe:init',
            publicKey: 'pk_test_123',
            options: {
                mode: 'setup',
                wallets: { applePay: 'auto' },
                fields: { billingDetails: 'never' },
            },
            countryCode: 'NL',
            email: 'jane@example.com',
            name: 'Jane Doe',
            ...overrides,
        });

    const posted = () => parent.postMessage.mock.calls.map(([message]) => message);

    return {
        send,
        init,
        posted,
        parent,
        Stripe,
        stripe,
        elements,
        paymentElement,
        paymentElementHandlers,
        observe,
        document,
        resize: () => resizeCallback?.(),
    };
}

describe('STRIPE_FRAME_SRCDOC', () => {
    describe('document', () => {
        it('loads Stripe.js from the pinned URL and has a root to mount into', () => {
            const doc = parseSrcdoc();

            expect(doc.querySelector('script[src]')?.getAttribute('src')).toBe(STRIPE_SCRIPT_URL);
            expect(doc.getElementById('stripe-root')).not.toBeNull();
        });

        it('has an inline script that parses and runs without a message', () => {
            expect(() => runFrame()).not.toThrow();
        });
    });

    describe('contract with PaymentIntegrationFormStripeFrame', () => {
        const typesIn = (source: string, pattern: RegExp) =>
            [...new Set([...source.matchAll(pattern)].map(([, type]) => type))].sort();

        it('posts exactly the message types the parent component handles', () => {
            const posted = typesIn(STRIPE_FRAME_SRCDOC, /type: '(stripe:[a-z:]+)'/g);

            expect(posted).toEqual(typesIn(frameSource, /case '(stripe:[a-z:]+)'/g));
            expect(posted).toEqual([
                'stripe:change',
                'stripe:loaderror',
                'stripe:ready',
                'stripe:resize',
                'stripe:submit:error',
                'stripe:submit:success',
            ]);
        });

        it('handles exactly the message types the parent component sends', () => {
            const handled = typesIn(
                STRIPE_FRAME_SRCDOC,
                /event\.data\.type === '(stripe:[a-z:]+)'/g,
            );

            expect(handled).toEqual(typesIn(frameSource, /type: '(stripe:[a-z:]+)'/g));
            expect(handled).toEqual(['stripe:init', 'stripe:submit']);
        });
    });

    describe('stripe:init', () => {
        it('creates the payment element with the key and options it is sent and mounts it', () => {
            const frame = runFrame();

            frame.init();

            expect(frame.Stripe).toHaveBeenCalledExactlyOnceWith('pk_test_123');
            expect(frame.stripe.elements).toHaveBeenCalledExactlyOnceWith({
                mode: 'setup',
                wallets: { applePay: 'auto' },
                fields: { billingDetails: 'never' },
            });
            expect(frame.elements.create).toHaveBeenCalledExactlyOnceWith('payment', {
                layout: { type: 'accordion', defaultCollapsed: false },
                wallets: { applePay: 'auto' },
                fields: { billingDetails: 'never' },
            });
            expect(frame.paymentElement.mount).toHaveBeenCalledExactlyOnceWith('#stripe-root');
        });

        it('ignores messages that do not come from the parent window', () => {
            const frame = runFrame();

            frame.send(
                { type: 'stripe:init', publicKey: 'pk_evil', options: {} },
                { source: { postMessage: vi.fn() } },
            );

            expect(frame.Stripe).not.toHaveBeenCalled();
        });

        it.each([null, undefined, 'stripe:init', 42])(
            'ignores a message whose data is %j',
            (data) => {
                const frame = runFrame();

                frame.send(data);

                expect(frame.Stripe).not.toHaveBeenCalled();
                expect(frame.parent.postMessage).not.toHaveBeenCalled();
            },
        );
    });

    describe('events posted to the parent', () => {
        it('reports ready, changes and load errors only to the origin that initialised it', () => {
            const frame = runFrame();
            frame.init();

            frame.paymentElementHandlers['ready']?.({});
            frame.paymentElementHandlers['change']?.({ value: { type: 'ideal' } });
            frame.paymentElementHandlers['loaderror']?.({
                error: { message: 'Invalid key', type: 'invalid_request_error', extra: 'x' },
            });

            expect(frame.parent.postMessage.mock.calls).toEqual([
                [{ type: 'stripe:ready' }, PARENT_ORIGIN],
                [{ type: 'stripe:change', paymentMethodType: 'ideal' }, PARENT_ORIGIN],
                [
                    {
                        type: 'stripe:loaderror',
                        error: { message: 'Invalid key', type: 'invalid_request_error' },
                    },
                    PARENT_ORIGIN,
                ],
            ]);
        });

        it('reports its document height whenever it resizes', () => {
            const frame = runFrame();
            frame.init();

            expect(frame.observe).toHaveBeenCalledExactlyOnceWith(frame.document.documentElement);

            frame.resize();
            frame.document.documentElement.scrollHeight = 530;
            frame.resize();

            expect(frame.parent.postMessage.mock.calls).toEqual([
                [{ type: 'stripe:resize', height: 412 }, PARENT_ORIGIN],
                [{ type: 'stripe:resize', height: 530 }, PARENT_ORIGIN],
            ]);
        });

        it('never posts with a wildcard target origin', async () => {
            const frame = runFrame();
            frame.init();
            frame.paymentElementHandlers['ready']?.({});
            frame.resize();
            frame.send({ type: 'stripe:submit' });
            await flushPromises();

            expect(frame.parent.postMessage).toHaveBeenCalled();
            for (const [, targetOrigin] of frame.parent.postMessage.mock.calls) {
                expect(targetOrigin).toBe(PARENT_ORIGIN);
            }
        });
    });

    describe('stripe:submit', () => {
        it('confirms with the billing details from init and posts the token id', async () => {
            const frame = runFrame();
            frame.init();

            frame.send({ type: 'stripe:submit' });
            await flushPromises();

            expect(frame.elements.submit).toHaveBeenCalledTimes(1);
            expect(frame.stripe.createConfirmationToken).toHaveBeenCalledExactlyOnceWith({
                elements: frame.elements,
                params: {
                    payment_method_data: {
                        billing_details: {
                            address: { country: 'NL' },
                            email: 'jane@example.com',
                            name: 'Jane Doe',
                        },
                    },
                },
            });
            expect(frame.parent.postMessage).toHaveBeenCalledExactlyOnceWith(
                { type: 'stripe:submit:success', confirmationTokenId: 'ctoken_123' },
                PARENT_ORIGIN,
            );
        });

        it('prefers the email and name sent with the submit, even when they are cleared', async () => {
            const frame = runFrame();
            frame.init();

            frame.send({ type: 'stripe:submit', email: 'new@example.com', name: undefined });
            await flushPromises();

            expect(frame.stripe.createConfirmationToken).toHaveBeenCalledWith(
                expect.objectContaining({
                    params: {
                        payment_method_data: {
                            billing_details: {
                                address: { country: 'NL' },
                                email: 'new@example.com',
                            },
                        },
                    },
                }),
            );
        });

        it('sends no billing details when it knows none', async () => {
            const frame = runFrame();
            frame.init({ countryCode: undefined, email: undefined, name: undefined });

            frame.send({ type: 'stripe:submit' });
            await flushPromises();

            expect(frame.stripe.createConfirmationToken).toHaveBeenCalledWith({
                elements: frame.elements,
                params: {},
            });
        });

        it('ignores a submit before it has been initialised', async () => {
            const frame = runFrame();

            frame.send({ type: 'stripe:submit' });
            await flushPromises();

            expect(frame.elements.submit).not.toHaveBeenCalled();
            expect(frame.parent.postMessage).not.toHaveBeenCalled();
        });

        it('ignores a submit from an origin other than the one that initialised it', async () => {
            const frame = runFrame();
            frame.init();

            frame.send({ type: 'stripe:submit' }, { origin: 'https://evil.example' });
            await flushPromises();

            expect(frame.elements.submit).not.toHaveBeenCalled();
        });

        it('posts the validation error and stops when the form is incomplete', async () => {
            const frame = runFrame({
                submitResult: {
                    error: {
                        message: 'Your card number is incomplete.',
                        type: 'validation_error',
                        code: 'incomplete_number',
                    },
                },
            });
            frame.init();

            frame.send({ type: 'stripe:submit' });
            await flushPromises();

            expect(frame.stripe.createConfirmationToken).not.toHaveBeenCalled();
            expect(frame.posted()).toEqual([
                {
                    type: 'stripe:submit:error',
                    error: {
                        message: 'Your card number is incomplete.',
                        type: 'validation_error',
                        code: 'incomplete_number',
                    },
                },
            ]);
        });

        it('posts the error when the confirmation token cannot be created', async () => {
            const frame = runFrame({
                tokenResult: {
                    error: {
                        message: 'Your card was declined.',
                        type: 'card_error',
                        code: 'card_declined',
                    },
                },
            });
            frame.init();

            frame.send({ type: 'stripe:submit' });
            await flushPromises();

            expect(frame.posted()).toEqual([
                {
                    type: 'stripe:submit:error',
                    error: {
                        message: 'Your card was declined.',
                        type: 'card_error',
                        code: 'card_declined',
                    },
                },
            ]);
        });
    });
});
