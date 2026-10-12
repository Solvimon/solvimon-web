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
}

function frameScript(): string {
    const scripts = [...STRIPE_FRAME_SRCDOC.matchAll(/<script>([\s\S]*?)<\\?\/script>/g)];
    const script = scripts.at(-1)?.[1];
    if (!script) throw new Error('No inline script in the srcdoc');
    return script;
}

function loadFrame(stripe: {
    elements: () => StubElements;
    createConfirmationToken: ReturnType<typeof vi.fn>;
}) {
    let listener: Listener | undefined;
    const parent = { postMessage: vi.fn() };
    const frameWindow = {
        parent,
        addEventListener: (_type: string, fn: Listener) => {
            listener = fn;
        },
    };
    const document = { documentElement: {} };
    class ResizeObserverStub {
        observe() {}
    }

    new Function('window', 'parent', 'Stripe', 'document', 'ResizeObserver', frameScript())(
        frameWindow,
        parent,
        () => stripe,
        document,
        ResizeObserverStub,
    );

    const send = (data: unknown) => listener?.({ data, source: parent, origin: PARENT_ORIGIN });
    const posted = () =>
        parent.postMessage.mock.calls.map(([message]) => message as { type: string });
    const answers = () => posted().filter(({ type }) => type.startsWith('stripe:submit:'));

    return { send, posted, answers };
}

function paymentElement() {
    return { on: vi.fn(), mount: vi.fn() };
}

function stubElements(submit: () => Promise<unknown>): StubElements {
    return { submit: vi.fn(submit), create: vi.fn(() => paymentElement()) };
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
});
