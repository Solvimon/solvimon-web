import type { PaymentMethodOptionResponseEntry } from '@solvimon/solvimon-types';
import {
    hasRenderablePaymentIntegration,
    isRenderablePaymentIntegration,
} from './PaymentIntegrationForm.lib';
import {
    createPaymentMethodOptionEntry,
    createPaymentMethodOptionsResponseWithoutOptions,
} from '@/test-utils/paymentMethodOptionsFixture';

const withoutOptions = () => createPaymentMethodOptionsResponseWithoutOptions()[0];

const stripeEntry = ({ withKey }: { withKey: boolean }) =>
    createPaymentMethodOptionEntry({ gateway: 'STRIPE', withoutStripePublicKey: !withKey });

describe('isRenderablePaymentIntegration', () => {
    describe('Adyen', () => {
        it('is renderable with payment methods to build a drop-in from', () => {
            expect(isRenderablePaymentIntegration(createPaymentMethodOptionEntry())).toBe(true);
        });

        it('is not renderable when the options array is missing altogether', () => {
            expect(isRenderablePaymentIntegration(withoutOptions())).toBe(false);
        });

        it('is not renderable when the options array is present but empty', () => {
            expect(
                isRenderablePaymentIntegration(createPaymentMethodOptionEntry({ options: [] })),
            ).toBe(false);
        });

        it('is not renderable when its only method is an express one the drop-in leaves out', () => {
            const entry = createPaymentMethodOptionEntry({
                options: [
                    {
                        name: 'Apple Pay',
                        payment_method_variant: 'APPLE_PAY',
                        payment_gateway_variant: 'ADYEN',
                        adyen: { name: 'Apple Pay', type: 'applepay' },
                    },
                ],
            });

            expect(isRenderablePaymentIntegration(entry)).toBe(true);
            expect(
                isRenderablePaymentIntegration(entry, { excludeExpressPaymentMethods: true }),
            ).toBe(false);
        });
    });

    describe('Stripe', () => {
        it('is renderable on a public key alone, which is all its frame needs', () => {
            expect(isRenderablePaymentIntegration(stripeEntry({ withKey: true }))).toBe(true);
        });

        it('is not renderable without one', () => {
            expect(isRenderablePaymentIntegration(stripeEntry({ withKey: false }))).toBe(false);
        });
    });

    it('is not renderable when the integration names no gateway at all', () => {
        const entry = createPaymentMethodOptionEntry();
        // The contract says `payment_gateway` is always there; the live payload proves otherwise.
        const { payment_gateway: _gateway, ...integration } = entry.integration;

        expect(
            isRenderablePaymentIntegration({
                ...entry,
                integration:
                    integration as unknown as PaymentMethodOptionResponseEntry['integration'],
            }),
        ).toBe(false);
    });
});

describe('hasRenderablePaymentIntegration', () => {
    it('is false for no options at all', () => {
        expect(hasRenderablePaymentIntegration([])).toBe(false);
    });

    it('is false when every entry would render as nothing', () => {
        expect(
            hasRenderablePaymentIntegration([withoutOptions(), stripeEntry({ withKey: false })]),
        ).toBe(false);
    });

    it('is true when one entry still works, so a broken acceptor beside it is not the verdict', () => {
        expect(
            hasRenderablePaymentIntegration([withoutOptions(), stripeEntry({ withKey: true })]),
        ).toBe(true);
    });
});
