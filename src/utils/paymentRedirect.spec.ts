import {
    clearPaymentRedirectParams,
    hasPaymentRedirectReturn,
    readAdyenRedirectReturn,
    readStripeRedirectReturn,
} from './paymentRedirect';

const PI_SECRET = 'pi_3Abc123_secret_Xyz789';
const SETI_SECRET = 'seti_1Def456_secret_Uvw012';

function visit(search: string) {
    window.history.replaceState(null, '', `/checkout${search}`);
}

describe('paymentRedirect', () => {
    afterEach(() => visit(''));

    describe('hasPaymentRedirectReturn', () => {
        it.each([
            ['?payment_acceptor_id=paya_1&redirectResult=abc', true],
            ['?payment_acceptor_id=paya_1&redirect_status=succeeded', true],
            ['?payment_acceptor_id=paya_1', false],
            ['?redirectResult=abc', false],
            ['', false],
        ])('reads %s as %s', (search, expected) => {
            visit(search);
            expect(hasPaymentRedirectReturn()).toBe(expected);
        });
    });

    describe('readAdyenRedirectReturn', () => {
        it('returns the result addressed to this acceptor, as the address decoded it', () => {
            visit('?payment_acceptor_id=paya_1&redirectResult=X6XtfGC3%21H4sI%2B%2F_-.%3D');
            expect(readAdyenRedirectReturn('paya_1')).toEqual({
                kind: 'RESULT',
                redirectResult: 'X6XtfGC3!H4sI+/_-.=',
            });
        });

        it('leaves another acceptor its own return', () => {
            visit('?payment_acceptor_id=paya_2&redirectResult=abc');
            expect(readAdyenRedirectReturn('paya_1')).toBeUndefined();
        });

        it('says when the return names no acceptor', () => {
            visit('?redirectResult=abc');
            expect(readAdyenRedirectReturn('paya_1')).toEqual({
                kind: 'MISSING_PAYMENT_ACCEPTOR',
            });
        });

        it.each([
            ['a b'],
            ['a\u0000b'],
            ['x'.repeat(16385)],
            ['%'],
            ['Ab%2Bc'],
            ['<script>alert(1)</script>'],
            ['"quoted"'],
        ])('turns down a result no gateway sends: %#', (value) => {
            visit(`?payment_acceptor_id=paya_1&redirectResult=${encodeURIComponent(value)}`);
            expect(readAdyenRedirectReturn('paya_1')).toEqual({ kind: 'INVALID' });
        });

        it('finds nothing without a redirect result', () => {
            visit('?payment_acceptor_id=paya_1');
            expect(readAdyenRedirectReturn('paya_1')).toBeUndefined();
        });
    });

    describe('readStripeRedirectReturn', () => {
        it('reads a payment intent return', () => {
            visit(
                `?payment_acceptor_id=paya_1&redirect_status=succeeded&payment_intent_client_secret=${PI_SECRET}`,
            );
            expect(readStripeRedirectReturn('paya_1')).toEqual({
                redirectStatus: 'succeeded',
                intent: 'PAYMENT',
                clientSecret: PI_SECRET,
            });
        });

        it('reads a setup intent return', () => {
            visit(
                `?payment_acceptor_id=paya_1&redirect_status=failed&setup_intent_client_secret=${SETI_SECRET}`,
            );
            expect(readStripeRedirectReturn('paya_1')).toEqual({
                redirectStatus: 'failed',
                intent: 'SETUP',
                clientSecret: SETI_SECRET,
            });
        });

        it.each([
            [
                'another acceptor',
                `?payment_acceptor_id=paya_2&redirect_status=succeeded&payment_intent_client_secret=${PI_SECRET}`,
            ],
            [
                'a malformed secret',
                '?payment_acceptor_id=paya_1&redirect_status=succeeded&payment_intent_client_secret=pi_1%2F..',
            ],
            [
                'a setup secret posing as a payment one',
                `?payment_acceptor_id=paya_1&redirect_status=succeeded&payment_intent_client_secret=${SETI_SECRET}`,
            ],
            [
                'a malformed status',
                `?payment_acceptor_id=paya_1&redirect_status=%3Cb%3E&payment_intent_client_secret=${PI_SECRET}`,
            ],
            ['no secret', '?payment_acceptor_id=paya_1&redirect_status=succeeded'],
        ])('finds nothing for %s', (_, search) => {
            visit(search);
            expect(readStripeRedirectReturn('paya_1')).toBeUndefined();
        });
    });

    describe('clearPaymentRedirectParams', () => {
        it('takes every redirect parameter out and keeps the rest', () => {
            visit(
                `?coupon_code=SAVE&payment_acceptor_id=paya_1&redirectResult=abc&redirect_status=succeeded&payment_intent=pi_1&payment_intent_client_secret=${PI_SECRET}&setup_intent=seti_1&setup_intent_client_secret=${SETI_SECRET}#plans`,
            );

            clearPaymentRedirectParams();

            expect(window.location.search).toBe('?coupon_code=SAVE');
            expect(window.location.hash).toBe('#plans');
            expect(window.location.pathname).toBe('/checkout');
        });

        it('leaves the history alone when there is nothing to clear', () => {
            visit('?coupon_code=SAVE');
            const replaceState = vi.spyOn(window.history, 'replaceState');

            clearPaymentRedirectParams();

            expect(replaceState).not.toHaveBeenCalled();
            replaceState.mockRestore();
        });
    });
});
