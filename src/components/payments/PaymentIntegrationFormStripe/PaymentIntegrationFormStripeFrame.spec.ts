import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import PaymentIntegrationFormStripeFrame from './PaymentIntegrationFormStripeFrame.vue';
import type { PaymentIntegrationFormStripeFrameProps } from './PaymentIntegrationFormStripeFrame.types';

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
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), writable: true, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true, configurable: true });
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
        it('posts stripe:init with publicKey, options, and countryCode on iframe load', async () => {
            const wrapper = mount(PaymentIntegrationFormStripeFrame, {
                props: { ...defaultProps, countryCode: 'NL' },
            });
            const iframe = wrapper.find('iframe').element as HTMLIFrameElement;
            const cw = mockContentWindow(iframe);

            await wrapper.find('iframe').trigger('load');

            expect(cw.postMessage).toHaveBeenCalledWith(
                {
                    type: 'stripe:init',
                    publicKey: 'pk_test_123',
                    options: defaultProps.options,
                    countryCode: 'NL',
                },
                '*',
            );
        });

        it('re-sends stripe:init when options change', async () => {
            const wrapper = mount(PaymentIntegrationFormStripeFrame, { props: defaultProps });
            const iframe = wrapper.find('iframe').element as HTMLIFrameElement;
            const cw = mockContentWindow(iframe);

            await wrapper.setProps({
                options: { mode: 'payment', currency: 'eur', amount: 2000, setup_future_usage: 'off_session' },
            });

            expect(cw.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'stripe:init' }),
                '*',
            );
        });

        it('does not re-send stripe:init when options are unchanged', async () => {
            const wrapper = mount(PaymentIntegrationFormStripeFrame, { props: defaultProps });
            const iframe = wrapper.find('iframe').element as HTMLIFrameElement;
            const cw = mockContentWindow(iframe);

            await wrapper.setProps({ options: { ...defaultProps.options } });

            expect(cw.postMessage).not.toHaveBeenCalled();
        });
    });

    describe('triggerSubmit', () => {
        it('posts stripe:submit to the iframe contentWindow', () => {
            const wrapper = mount(PaymentIntegrationFormStripeFrame, { props: defaultProps });
            const iframe = wrapper.find('iframe').element as HTMLIFrameElement;
            const cw = mockContentWindow(iframe);

            wrapper.vm.triggerSubmit();

            expect(cw.postMessage).toHaveBeenCalledWith({ type: 'stripe:submit' }, '*');
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

        it('does not emit submit-success when confirmationTokenId is missing', () => {
            const { wrapper, cw } = setup();
            dispatchMessage(cw, { type: 'stripe:submit:success' });
            expect(wrapper.emitted('submit-success')).toBeUndefined();
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
    });
});
