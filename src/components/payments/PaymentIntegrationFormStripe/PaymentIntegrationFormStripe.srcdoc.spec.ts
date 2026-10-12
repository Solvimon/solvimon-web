import { flushPromises } from '@vue/test-utils';
import { STRIPE_FRAME_SRCDOC } from './PaymentIntegrationFormStripe.srcdoc';
import { STRIPE_SCRIPT_URL } from './PaymentIntegrationFormStripe.constants';
import frameSource from './PaymentIntegrationFormStripeFrame.vue?raw';

/**
 * Runs the script the Stripe frame loads against a stand-in Stripe, so what it posts back can be
 * read. Every `stripe:submit` must be answered exactly once, or the screen waits for good.
 */

const PARENT_ORIGIN = 'https://host.example';

type Listener = (event: { data: unknown; source: unknown; origin: string }) => void;

interface StubElements {
    submit: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
}

function frameScript(): string {
    const scripts = [...STRIPE_FRAME_SRCDOC.matchAll(/<script>([\s\S]*?)<\\?\/script>/g)];
    const script = scripts.at(-1)?.[1];
    if (!script) throw new Error('No inline script in the srcdoc');
    return script;
}

function loadFrame(
    stripe: {
        elements: () => StubElements;
        createConfirmationToken: ReturnType<typeof vi.fn>;
    },
    parentOrigin = PARENT_ORIGIN,
) {
    let listener: Listener | undefined;
    const parent = { postMessage: vi.fn() };
    const frameWindow = {
        parent,
        addEventListener: (_type: string, fn: Listener) => {
            listener = fn;
        },
    };
    const document = { documentElement: {} };
    const observers: unknown[] = [];
    class ResizeObserverStub {
        constructor() {
            observers.push(this);
        }
        observe() {}
    }

    new Function('window', 'parent', 'Stripe', 'document', 'ResizeObserver', frameScript())(
        frameWindow,
        parent,
        () => stripe,
        document,
        ResizeObserverStub,
    );

    const send = (data: unknown, origin = parentOrigin) =>
        listener?.({ data, source: parent, origin });
    const posted = () =>
        parent.postMessage.mock.calls.map(([message]) => message as { type: string });
    const answers = () => posted().filter(({ type }) => type.startsWith('stripe:submit:'));
    const targets = () => parent.postMessage.mock.calls.map(([, target]) => target as string);

    return { send, posted, answers, targets, observers };
}

function paymentElement() {
    return { on: vi.fn(), mount: vi.fn(), destroy: vi.fn() };
}

function stubElements(submit: () => Promise<unknown>): StubElements {
    return {
        submit: vi.fn(submit),
        create: vi.fn(() => paymentElement()),
        update: vi.fn(() => Promise.resolve()),
    };
}

/** Says the element set up last is ready, as Stripe does once it has drawn its fields. */
function readyLast(element: ReturnType<typeof paymentElement>) {
    const [, onReady] = element.on.mock.calls.find(([event]) => event === 'ready') ?? [];
    (onReady as () => void)();
}

const INIT = { type: 'stripe:init', publicKey: 'pk', options: {} };

describe('Stripe frame script', () => {
    it('answers a submit whose confirmation token rejects', async () => {
        const frame = loadFrame({
            elements: () => stubElements(() => Promise.resolve({})),
            createConfirmationToken: vi.fn(() => Promise.reject(new Error('network'))),
        });
        frame.send(INIT);

        frame.send({ type: 'stripe:submit' });
        await flushPromises();

        expect(frame.answers()).toEqual([
            {
                type: 'stripe:submit:error',
                error: { message: 'network', type: undefined, code: undefined },
            },
        ]);
    });

    it('answers a submit whose elements.submit rejects with a non-error', async () => {
        const frame = loadFrame({
            elements: () => stubElements(() => Promise.reject(undefined)),
            createConfirmationToken: vi.fn(),
        });
        frame.send(INIT);

        frame.send({ type: 'stripe:submit' });
        await flushPromises();

        expect(frame.answers()).toHaveLength(1);
        expect(frame.answers()[0]).toMatchObject({
            type: 'stripe:submit:error',
            error: { message: 'Stripe submission failed' },
        });
    });

    it('answers a successful submit once', async () => {
        const frame = loadFrame({
            elements: () => stubElements(() => Promise.resolve({})),
            createConfirmationToken: vi.fn(() =>
                Promise.resolve({ confirmationToken: { id: 'ctoken_1' } }),
            ),
        });
        frame.send(INIT);

        frame.send({ type: 'stripe:submit' });
        await flushPromises();

        expect(frame.answers()).toEqual([
            { type: 'stripe:submit:success', confirmationTokenId: 'ctoken_1' },
        ]);
    });

    // The submit in flight reads `elements` after the frame was set up anew, so the token is
    // asked of elements that were never submitted. It must still be answered, once.
    it('answers a submit that was in flight when the frame was set up anew', async () => {
        let resolveFirstSubmit: (value: unknown) => void = () => {};
        const first = stubElements(
            () =>
                new Promise((resolve) => {
                    resolveFirstSubmit = resolve;
                }),
        );
        const second = stubElements(() => Promise.resolve({}));
        const created = [first, second];
        const createConfirmationToken = vi.fn(({ elements }: { elements: StubElements }) =>
            elements === second
                ? Promise.reject(new Error('elements.submit() must be called first'))
                : Promise.resolve({ confirmationToken: { id: 'ctoken_1' } }),
        );
        const frame = loadFrame({
            elements: () => created.shift() as StubElements,
            createConfirmationToken,
        });
        frame.send(INIT);

        frame.send({ type: 'stripe:submit' });
        frame.send(INIT);
        resolveFirstSubmit({});
        await flushPromises();

        expect(frame.answers()).toEqual([
            { type: 'stripe:submit:success', confirmationTokenId: 'ctoken_1' },
        ]);
        expect(createConfirmationToken).toHaveBeenCalledWith(
            expect.objectContaining({ elements: first }),
        );
    });

    it('names the setup it is ready for', () => {
        const element = paymentElement();
        const frame = loadFrame({
            elements: () => ({ submit: vi.fn(), create: vi.fn(() => element) }),
            createConfirmationToken: vi.fn(),
        });
        frame.send({ ...INIT, initId: 7 });

        const [, onReady] = element.on.mock.calls.find(([event]) => event === 'ready') ?? [];
        (onReady as () => void)();

        expect(frame.posted()).toContainEqual({ type: 'stripe:ready', initId: 7 });
    });

    describe('set up anew', () => {
        it('takes down the Payment Element before it mounts another', () => {
            const elements = [paymentElement(), paymentElement()];
            const created = [...elements];
            const frame = loadFrame({
                elements: () => ({ submit: vi.fn(), create: vi.fn(() => created.shift()) }),
                createConfirmationToken: vi.fn(),
            });

            frame.send({ ...INIT, initId: 1 });
            frame.send({ ...INIT, initId: 2 });

            expect(elements[0]?.destroy).toHaveBeenCalledTimes(1);
            expect(elements[1]?.destroy).not.toHaveBeenCalled();
            expect(elements[1]?.mount).toHaveBeenCalledWith('#stripe-root');
        });

        it('keeps one size observer however often it is set up', () => {
            const frame = loadFrame({
                elements: () => stubElements(() => Promise.resolve({})),
                createConfirmationToken: vi.fn(),
            });

            frame.send(INIT);
            frame.send(INIT);

            expect(frame.observers).toHaveLength(1);
        });
    });

    describe('stripe:update', () => {
        const UPDATE = {
            type: 'stripe:update',
            options: { currency: 'eur', amount: 900, setup_future_usage: null },
        };

        it('updates the elements it has instead of making new ones', async () => {
            const elements = stubElements(() => Promise.resolve({}));
            const makeElements = vi.fn(() => elements);
            const frame = loadFrame({ elements: makeElements, createConfirmationToken: vi.fn() });
            frame.send(INIT);

            frame.send(UPDATE);
            await flushPromises();

            expect(elements.update).toHaveBeenCalledWith(UPDATE.options);
            expect(makeElements).toHaveBeenCalledTimes(1);
            expect(elements.create).toHaveBeenCalledTimes(1);
            expect(frame.posted()).not.toContainEqual({ type: 'stripe:update:error' });
        });

        it('asks to be set up anew when Stripe refuses the update', async () => {
            const elements = stubElements(() => Promise.resolve({}));
            elements.update = vi.fn(() => {
                throw new Error('IntegrationError');
            });
            const frame = loadFrame({ elements: () => elements, createConfirmationToken: vi.fn() });
            frame.send(INIT);

            frame.send(UPDATE);
            await flushPromises();

            expect(frame.posted()).toContainEqual({ type: 'stripe:update:error' });
        });

        it('ignores an update from another origin', async () => {
            const elements = stubElements(() => Promise.resolve({}));
            const frame = loadFrame({ elements: () => elements, createConfirmationToken: vi.fn() });
            frame.send(INIT);

            frame.send(UPDATE, 'https://evil.example');
            await flushPromises();

            expect(elements.update).not.toHaveBeenCalled();
        });
    });

    describe('target origin', () => {
        it('posts only to the origin that set it up', () => {
            const element = paymentElement();
            const frame = loadFrame({
                elements: () => ({ submit: vi.fn(), create: vi.fn(() => element) }),
                createConfirmationToken: vi.fn(),
            });
            frame.send(INIT);

            readyLast(element);

            expect(frame.targets()).toEqual([PARENT_ORIGIN]);
        });

        // postMessage throws on 'null' as a target, so the frame would never say it is ready.
        it('posts to any origin when the page that set it up has an opaque one', () => {
            const element = paymentElement();
            const frame = loadFrame(
                {
                    elements: () => ({ submit: vi.fn(), create: vi.fn(() => element) }),
                    createConfirmationToken: vi.fn(),
                },
                'null',
            );
            frame.send(INIT);

            readyLast(element);

            expect(frame.targets()).toEqual(['*']);
        });
    });

    it('bills the country the submit names over the one it was set up with', async () => {
        const createConfirmationToken = vi.fn(() =>
            Promise.resolve({ confirmationToken: { id: 'ctoken_1' } }),
        );
        const frame = loadFrame({
            elements: () => stubElements(() => Promise.resolve({})),
            createConfirmationToken,
        });
        frame.send({ ...INIT, countryCode: 'NL' });

        frame.send({ type: 'stripe:submit', countryCode: 'DE' });
        await flushPromises();

        expect(createConfirmationToken).toHaveBeenCalledWith(
            expect.objectContaining({
                params: {
                    payment_method_data: { billing_details: { address: { country: 'DE' } } },
                },
            }),
        );
    });
});

describe('Stripe frame script, with updates out of order and messages across windows', () => {
    const UPDATE = { type: 'stripe:update', options: { currency: 'eur', amount: 900 } };

    it('applies an update that follows a setup anew to the new elements', async () => {
        const made = [
            stubElements(() => Promise.resolve({})),
            stubElements(() => Promise.resolve({})),
        ];
        const queue = [...made];
        const frame = loadFrame({
            elements: () => queue.shift()!,
            createConfirmationToken: vi.fn(),
        });
        frame.send({ ...INIT, initId: 1 });
        frame.send({ ...INIT, initId: 2 });

        frame.send(UPDATE);
        await flushPromises();

        expect(made[0]?.update).not.toHaveBeenCalled();
        expect(made[1]?.update).toHaveBeenCalledWith(UPDATE.options);
    });

    it('asks for no setup anew when the elements it failed on are already gone', async () => {
        let rejectUpdate: (error: Error) => void = () => {};
        const first = stubElements(() => Promise.resolve({}));
        first.update = vi.fn(
            () =>
                new Promise((_, reject) => {
                    rejectUpdate = reject;
                }),
        );
        const queue = [first, stubElements(() => Promise.resolve({}))];
        const frame = loadFrame({
            elements: () => queue.shift()!,
            createConfirmationToken: vi.fn(),
        });
        frame.send({ ...INIT, initId: 1 });
        frame.send(UPDATE);
        await flushPromises();

        frame.send({ ...INIT, initId: 2 });
        rejectUpdate(new Error('IntegrationError'));
        await flushPromises();

        expect(frame.posted()).not.toContainEqual({ type: 'stripe:update:error' });
    });

    it('ignores an update before it has been set up', async () => {
        const frame = loadFrame({
            elements: () => stubElements(() => Promise.resolve({})),
            createConfirmationToken: vi.fn(),
        });

        frame.send(UPDATE);
        await flushPromises();

        expect(frame.posted()).toEqual([]);
    });

    it('takes no init or update from a window that is not its parent', async () => {
        const makeElements = vi.fn(() => stubElements(() => Promise.resolve({})));
        let listener:
            | ((event: { data: unknown; source: unknown; origin: string }) => void)
            | undefined;
        const parent = { postMessage: vi.fn() };
        new Function('window', 'parent', 'Stripe', 'document', 'ResizeObserver', frameScript())(
            { parent, addEventListener: (_: string, fn: typeof listener) => (listener = fn) },
            parent,
            () => ({ elements: makeElements, createConfirmationToken: vi.fn() }),
            { documentElement: {} },
            class {
                observe() {}
            },
        );
        const sibling = { postMessage: vi.fn() };

        listener?.({ data: INIT, source: sibling, origin: PARENT_ORIGIN });
        listener?.({ data: UPDATE, source: sibling, origin: PARENT_ORIGIN });
        await flushPromises();

        expect(makeElements).not.toHaveBeenCalled();
    });
});

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
                'stripe:update:error',
            ]);
        });

        it('handles exactly the message types the parent component sends', () => {
            const handled = typesIn(
                STRIPE_FRAME_SRCDOC,
                /event\.data\.type === '(stripe:[a-z:]+)'/g,
            );

            expect(handled).toEqual(typesIn(frameSource, /type: '(stripe:[a-z:]+)'/g));
            expect(handled).toEqual(['stripe:init', 'stripe:submit', 'stripe:update']);
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

        it('drops the email from init when the submit clears it', async () => {
            const frame = runFrame();
            frame.init();

            frame.send({ type: 'stripe:submit', email: undefined, name: 'New Name' });
            await flushPromises();

            expect(frame.stripe.createConfirmationToken).toHaveBeenCalledWith(
                expect.objectContaining({
                    params: {
                        payment_method_data: {
                            billing_details: {
                                address: { country: 'NL' },
                                name: 'New Name',
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
