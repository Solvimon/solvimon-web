import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import PaymentIntegrationFormStripeFrame from './PaymentIntegrationFormStripeFrame.vue';
import type { PaymentIntegrationFormStripeFrameProps } from './PaymentIntegrationFormStripeFrame.types';

/** Fields the Payment Element was not set up with, which it can only show by being made anew. */
const CHANGED_OPTIONS: PaymentIntegrationFormStripeFrameProps['options'] = {
    mode: 'payment',
    currency: 'eur',
    amount: 1000,
    setup_future_usage: 'off_session',
    fields: { billingDetails: { email: 'never' } },
};

/** What a promo code, a seat count or a country does: a new amount for the same form. */
const REPRICED_OPTIONS: PaymentIntegrationFormStripeFrameProps['options'] = {
    mode: 'payment',
    currency: 'eur',
    amount: 2000,
    setup_future_usage: 'off_session',
};

const ORIGIN = window.location.origin;

const defaultProps: PaymentIntegrationFormStripeFrameProps = {
    publicKey: 'pk_test_123',
    options: {
        mode: 'payment',
        currency: 'eur',
        amount: 1000,
        setup_future_usage: 'off_session',
    },
};

beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn(),
        writable: true,
        configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
        value: vi.fn(),
        writable: true,
        configurable: true,
    });
});

beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** Replace the iframe's contentWindow with a mock and return a postMessage spy. */
function mockContentWindow(iframe: HTMLIFrameElement): { postMessage: ReturnType<typeof vi.fn> } {
    const mockWindow = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(iframe, 'contentWindow', { get: () => mockWindow, configurable: true });
    return mockWindow as unknown as { postMessage: ReturnType<typeof vi.fn> };
}

/** Dispatch a MessageEvent from a specific source. */
function dispatchMessage(source: unknown, data: unknown) {
    window.dispatchEvent(
        new MessageEvent('message', { data, source: source as MessageEventSource }),
    );
}

describe('PaymentIntegrationFormStripeFrame', () => {
    describe('lifecycle', () => {
        it('creates a blob URL from the srcdoc and sets it as the iframe src', async () => {
            const wrapper = mount(PaymentIntegrationFormStripeFrame, { props: defaultProps });
            await nextTick();
            expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
            expect(wrapper.find('iframe').attributes('src')).toBe('blob:test-url');
        });

        it('registers a window message listener on mount', () => {
            const addSpy = vi.spyOn(window, 'addEventListener');
            mount(PaymentIntegrationFormStripeFrame, { props: defaultProps });
            expect(addSpy).toHaveBeenCalledWith('message', expect.any(Function));
        });

        it('removes the message listener and revokes the blob URL on unmount', () => {
            const removeSpy = vi.spyOn(window, 'removeEventListener');
            const wrapper = mount(PaymentIntegrationFormStripeFrame, { props: defaultProps });
            wrapper.unmount();
            expect(removeSpy).toHaveBeenCalledWith('message', expect.any(Function));
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
        });
    });

    describe('sendInit', () => {
        async function loaded(props: Partial<PaymentIntegrationFormStripeFrameProps> = {}) {
            const wrapper = mount(PaymentIntegrationFormStripeFrame, {
                props: { ...defaultProps, ...props },
            });
            const iframe = wrapper.find('iframe').element as HTMLIFrameElement;
            const cw = mockContentWindow(iframe);
            await wrapper.find('iframe').trigger('load');
            return { wrapper, cw };
        }

        function sentTypes(cw: { postMessage: ReturnType<typeof vi.fn> }) {
            return cw.postMessage.mock.calls.map(([message]) => (message as { type: string }).type);
        }

        it('posts stripe:init with publicKey, options, and countryCode on iframe load', async () => {
            const { cw } = await loaded({ countryCode: 'NL' });

            expect(cw.postMessage).toHaveBeenCalledWith(
                {
                    type: 'stripe:init',
                    initId: 1,
                    publicKey: 'pk_test_123',
                    options: defaultProps.options,
                    countryCode: 'NL',
                },
                ORIGIN,
            );
        });

        // The frame is a blob document of this page, so it has the page's origin; '*' would also
        // hand the key, email and name to whatever the frame had been navigated to.
        it('posts to the page origin, not to any origin', async () => {
            const { cw } = await loaded();
            expect(cw.postMessage.mock.calls.map(([, target]) => target)).toEqual([ORIGIN]);
        });

        it('leaves options that change before the frame loads to the load', async () => {
            const wrapper = mount(PaymentIntegrationFormStripeFrame, { props: defaultProps });
            const iframe = wrapper.find('iframe').element as HTMLIFrameElement;
            const cw = mockContentWindow(iframe);

            await wrapper.setProps({ options: REPRICED_OPTIONS });
            expect(cw.postMessage).not.toHaveBeenCalled();

            await wrapper.find('iframe').trigger('load');
            expect(cw.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'stripe:init', options: REPRICED_OPTIONS }),
                ORIGIN,
            );
        });

        // Setting it up anew stacked a second, empty Payment Element under the first.
        it('updates the Payment Element in place when only the amount changes', async () => {
            const { wrapper, cw } = await loaded();

            await wrapper.setProps({ options: REPRICED_OPTIONS });

            expect(sentTypes(cw)).toEqual(['stripe:init', 'stripe:update']);
            expect(cw.postMessage).toHaveBeenLastCalledWith(
                {
                    type: 'stripe:update',
                    options: { currency: 'eur', amount: 2000, setup_future_usage: 'off_session' },
                },
                ORIGIN,
            );
        });

        it('takes back keeping the method in place', async () => {
            const { wrapper, cw } = await loaded();
            const { setup_future_usage: _, ...notKept } = defaultProps.options;

            await wrapper.setProps({ options: notKept });

            expect(cw.postMessage).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    type: 'stripe:update',
                    options: expect.objectContaining({ setup_future_usage: null }),
                }),
                ORIGIN,
            );
        });

        it('sets the frame up anew when the fields it shows change', async () => {
            const { wrapper, cw } = await loaded();

            await wrapper.setProps({ options: CHANGED_OPTIONS });

            expect(cw.postMessage).toHaveBeenLastCalledWith(
                expect.objectContaining({ type: 'stripe:init', initId: 2 }),
                ORIGIN,
            );
        });

        it('sets the frame up anew when it could not update', async () => {
            const { wrapper, cw } = await loaded();
            await wrapper.setProps({ options: REPRICED_OPTIONS });

            dispatchMessage(cw, { type: 'stripe:update:error' });

            expect(cw.postMessage).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    type: 'stripe:init',
                    initId: 2,
                    options: REPRICED_OPTIONS,
                }),
                ORIGIN,
            );
        });

        it('does not post again when options are unchanged', async () => {
            const { wrapper, cw } = await loaded();

            await wrapper.setProps({ options: { ...defaultProps.options } });

            expect(sentTypes(cw)).toEqual(['stripe:init']);
        });
    });

    describe('triggerSubmit', () => {
        async function setup() {
            const wrapper = mount(PaymentIntegrationFormStripeFrame, {
                props: { ...defaultProps, countryCode: 'NL' },
            });
            const iframe = wrapper.find('iframe').element as HTMLIFrameElement;
            const cw = mockContentWindow(iframe);
            await wrapper.find('iframe').trigger('load');
            return { wrapper, iframe, cw };
        }

        const SUBMIT = { type: 'stripe:submit', countryCode: 'NL' };

        function sentSubmits(cw: { postMessage: ReturnType<typeof vi.fn> }) {
            return cw.postMessage.mock.calls.filter(
                ([message]) => (message as { type: string }).type === 'stripe:submit',
            );
        }

        /** The ready the current setup sends, echoing the id of the last `stripe:init`. */
        function sendReady(cw: { postMessage: ReturnType<typeof vi.fn> }) {
            const lastInit = cw.postMessage.mock.calls
                .map(([message]) => message as { type?: string; initId?: number })
                .filter(({ type }) => type === 'stripe:init')
                .at(-1);
            dispatchMessage(cw, { type: 'stripe:ready', initId: lastInit?.initId ?? 0 });
        }

        it('posts stripe:submit to the iframe contentWindow once Stripe is ready', async () => {
            const { wrapper, cw } = await setup();
            sendReady(cw);

            expect(wrapper.vm.triggerSubmit()).toBe(true);

            expect(cw.postMessage).toHaveBeenCalledWith(SUBMIT, ORIGIN);
        });

        // The frame would drop it, and the screen would wait on an answer that never comes.
        it('does not send a submit before Stripe is ready', async () => {
            const { wrapper, cw } = await setup();

            expect(wrapper.vm.triggerSubmit()).toBe(false);
            expect(sentSubmits(cw)).toEqual([]);
        });

        it('stays ready through a change of amount', async () => {
            const { wrapper, cw } = await setup();
            sendReady(cw);

            await wrapper.setProps({ options: REPRICED_OPTIONS });

            expect(wrapper.vm.triggerSubmit()).toBe(true);
        });

        it('sends the country the screen has now, not the one it was set up with', async () => {
            const { wrapper, cw } = await setup();
            sendReady(cw);

            await wrapper.setProps({ countryCode: 'DE', options: REPRICED_OPTIONS });
            wrapper.vm.triggerSubmit();

            expect(cw.postMessage).toHaveBeenLastCalledWith(
                { type: 'stripe:submit', countryCode: 'DE' },
                ORIGIN,
            );
        });

        it('waits for Stripe again after it is set up anew', async () => {
            const { wrapper, iframe, cw } = await setup();
            sendReady(cw);

            await iframe.dispatchEvent(new Event('load'));

            expect(wrapper.vm.triggerSubmit()).toBe(false);
        });

        it('passes on the answer to a submit sent before the options changed', async () => {
            const { wrapper, cw } = await setup();
            sendReady(cw);
            expect(wrapper.vm.triggerSubmit()).toBe(true);

            await wrapper.setProps({ options: CHANGED_OPTIONS });
            expect(wrapper.vm.triggerSubmit()).toBe(false);
            dispatchMessage(cw, { type: 'stripe:submit:error', error: { message: 'stale' } });

            expect(wrapper.emitted('submit-error')).toHaveLength(1);
        });

        it('sends submits again once the frame set up anew says it is ready', async () => {
            const { wrapper, cw } = await setup();
            sendReady(cw);

            await wrapper.setProps({ options: CHANGED_OPTIONS });
            sendReady(cw);

            expect(wrapper.vm.triggerSubmit()).toBe(true);
            expect(cw.postMessage).toHaveBeenLastCalledWith(SUBMIT, ORIGIN);
        });

        it('ignores a ready left over from before the frame was set up anew', async () => {
            const { wrapper, cw } = await setup();
            sendReady(cw);

            await wrapper.setProps({ options: CHANGED_OPTIONS });
            dispatchMessage(cw, { type: 'stripe:ready', initId: 0 });

            expect(wrapper.vm.triggerSubmit()).toBe(false);
        });
    });

    describe('handleMessage', () => {
        function setup() {
            const wrapper = mount(PaymentIntegrationFormStripeFrame, { props: defaultProps });
            const iframe = wrapper.find('iframe').element as HTMLIFrameElement;
            const cw = mockContentWindow(iframe);
            return { wrapper, cw };
        }

        it('ignores messages from a different source', () => {
            const { wrapper } = setup();
            dispatchMessage(window, { type: 'stripe:ready' });
            expect(wrapper.emitted('ready')).toBeUndefined();
        });

        it('ignores non-object message data', () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, 'not-an-object');
            expect(wrapper.emitted('ready')).toBeUndefined();
        });

        it('ignores messages with a non-stripe type', () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, { type: 'other:event' });
            expect(wrapper.emitted('ready')).toBeUndefined();
        });

        it('emits ready on stripe:ready', () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, { type: 'stripe:ready' });
            expect(wrapper.emitted('ready')).toHaveLength(1);
        });

        it('emits change with the paymentMethodType on stripe:change', () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, { type: 'stripe:change', paymentMethodType: 'sepa_debit' });
            expect(wrapper.emitted('change')?.[0]).toEqual(['sepa_debit']);
        });

        it('defaults paymentMethodType to "card" when stripe:change has no string type', () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, { type: 'stripe:change', paymentMethodType: 42 });
            expect(wrapper.emitted('change')?.[0]).toEqual(['card']);
        });

        it('emits loaderror with message and type on stripe:loaderror', () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, {
                type: 'stripe:loaderror',
                error: { message: 'Load failed', type: 'invalid_request_error' },
            });
            expect(wrapper.emitted('loaderror')?.[0]).toEqual([
                { message: 'Load failed', type: 'invalid_request_error' },
            ]);
        });

        it('updates the iframe height on stripe:resize', async () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, { type: 'stripe:resize', height: 320 });
            await nextTick();
            expect(wrapper.find('iframe').attributes('height')).toBe('320');
        });

        it('emits submit-success with the confirmationTokenId on stripe:submit:success', () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, {
                type: 'stripe:submit:success',
                confirmationTokenId: 'tok_abc123',
            });
            expect(wrapper.emitted('submit-success')?.[0]).toEqual(['tok_abc123']);
        });

        it('answers a stripe:submit:success without a confirmationTokenId with submit-error', () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, { type: 'stripe:submit:success' });
            expect(wrapper.emitted('submit-success')).toBeUndefined();
            expect(wrapper.emitted('submit-error')).toHaveLength(1);
        });

        it('emits submit-error with error details on stripe:submit:error', () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, {
                type: 'stripe:submit:error',
                error: { message: 'Card declined', type: 'card_error', code: 'card_declined' },
            });
            expect(wrapper.emitted('submit-error')?.[0]).toEqual([
                { message: 'Card declined', type: 'card_error', code: 'card_declined' },
            ]);
        });

        it('passes on only an error type Stripe defines', () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, {
                type: 'stripe:submit:error',
                error: { message: 'Something broke', type: 'not_a_stripe_type', code: 'x' },
            });
            expect(wrapper.emitted('submit-error')?.[0]).toEqual([
                { message: 'Something broke', type: undefined, code: 'x' },
            ]);
        });
    });
});

describe('PaymentIntegrationFormStripeFrame, tried from outside (DD-3539)', () => {
    async function loaded(props: Partial<PaymentIntegrationFormStripeFrameProps> = {}) {
        const wrapper = mount(PaymentIntegrationFormStripeFrame, {
            props: { ...defaultProps, ...props },
        });
        const iframe = wrapper.find('iframe').element as HTMLIFrameElement;
        const cw = mockContentWindow(iframe);
        await wrapper.find('iframe').trigger('load');
        return { wrapper, cw };
    }

    const messages = (cw: { postMessage: ReturnType<typeof vi.fn> }) =>
        cw.postMessage.mock.calls.map(
            ([message]) => message as { type: string; initId?: number; options?: unknown },
        );

    it('sends an update that comes before Stripe is ready, after the init it follows', async () => {
        const { wrapper, cw } = await loaded();

        await wrapper.setProps({ options: CHANGED_OPTIONS });
        await wrapper.setProps({ options: { ...CHANGED_OPTIONS, amount: 3000 } });

        expect(messages(cw).map(({ type }) => type)).toEqual([
            'stripe:init',
            'stripe:init',
            'stripe:update',
        ]);
        expect(messages(cw).at(-1)?.options).toMatchObject({ amount: 3000 });
        dispatchMessage(cw, { type: 'stripe:ready', initId: 2 });
        expect(wrapper.vm.triggerSubmit()).toBe(true);
    });

    it('compares the next change with what was sent, not with the last props', async () => {
        const { wrapper, cw } = await loaded();

        await wrapper.setProps({ options: REPRICED_OPTIONS });
        await wrapper.setProps({ options: defaultProps.options });

        expect(messages(cw).map(({ type }) => type)).toEqual([
            'stripe:init',
            'stripe:update',
            'stripe:update',
        ]);
        expect(messages(cw).at(-1)?.options).toMatchObject({ amount: 1000 });
    });

    it('answers a submit in flight when a refused update set the frame up anew', async () => {
        const { wrapper, cw } = await loaded();
        dispatchMessage(cw, { type: 'stripe:ready', initId: 1 });
        expect(wrapper.vm.triggerSubmit()).toBe(true);

        await wrapper.setProps({ options: REPRICED_OPTIONS });
        dispatchMessage(cw, { type: 'stripe:update:error' });
        dispatchMessage(cw, { type: 'stripe:submit:success', confirmationTokenId: 'ctok_1' });

        expect(wrapper.emitted('submit-success')).toEqual([['ctok_1']]);
        expect(wrapper.vm.triggerSubmit()).toBe(false);
    });

    it('ignores an update error posted by another window', async () => {
        const { cw } = await loaded();
        const before = cw.postMessage.mock.calls.length;

        dispatchMessage(window, { type: 'stripe:update:error' });

        expect(cw.postMessage.mock.calls.length).toBe(before);
    });

    // In a frame sandboxed without allow-same-origin, location.origin is still the URL's origin
    // while the document's, and so the blob frame's, is opaque. A message aimed at the URL's origin
    // is dropped and the frame is never set up; self.origin is the document's origin.
    it('posts to any origin when the document origin is opaque', async () => {
        const original = Object.getOwnPropertyDescriptor(window, 'origin');
        Object.defineProperty(window, 'origin', { value: 'null', configurable: true });
        try {
            const { cw } = await loaded();
            expect(cw.postMessage.mock.calls.map(([, target]) => target)).toEqual(['*']);
        } finally {
            if (original) Object.defineProperty(window, 'origin', original);
        }
    });
});
