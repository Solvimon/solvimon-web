import { flushPromises } from '@vue/test-utils';
import { STRIPE_FRAME_SRCDOC } from './PaymentIntegrationFormStripe.srcdoc';

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
