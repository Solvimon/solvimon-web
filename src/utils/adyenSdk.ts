/**
 * The one place `@adyen/adyen-web` is pulled in at runtime.
 *
 * Everything that needs the Adyen SDK goes through here, and the shape below is load-bearing in
 * three ways. Each one costs around 40 kB gzip on every screen that mounts a payment form, because
 * breaking any of them makes rollup ship all 83 of Adyen's exports rather than the 23 reachable
 * from here.
 *
 * 1. The components are destructured in the `then` callback, not read off the resolved module.
 *    `adyenModule[name]`, and `adyenModule.Card` just as much, leave rollup no way to see which
 *    exports are reachable. Passing the module through `Promise.all` hides them the same way, so
 *    what a caller composes with other promises is the object this builds, never the module.
 *
 * 2. The `import()` sits outside any `try` block. Rollup reads a dynamic import inside one as an
 *    optional dependency and stops tracking it entirely, however the call site is written. Callers
 *    may still wrap their `await` of this in a `try` — that is a different statement, and what
 *    this rejects with arrives there unchanged.
 *
 * 3. There is exactly one `import('@adyen/adyen-web')` in the SDK: this one. Rollup drops the
 *    optimisation as soon as a dynamically imported module is shared between two entry points,
 *    and this package builds a separate entry per screen and per component. Adding a second
 *    `import('@adyen/adyen-web')` anywhere would quietly undo it for every entry at once.
 */
export function loadAdyenSdk() {
    return import('@adyen/adyen-web').then(
        ({
            AdyenCheckout,
            Dropin,
            Card,
            Bancontact,
            Ach,
            AmazonPay,
            ApplePay,
            BcmcMobile,
            BacsDirectDebit,
            CashAppPay,
            EPS,
            GooglePay,
            Klarna,
            PayByBank,
            PayPal,
            SepaDirectDebit,
            Trustly,
            Twint,
            PayByBankUS,
            Redirect,
        }) => ({
            AdyenCheckout,
            Dropin,
            // Named individually as well for the express buttons, which mount one on its own
            // rather than through the drop-in.
            ApplePay,
            GooglePay,
            PayPal,
            /** The payment methods the drop-in is built with, in the order it offers them. */
            dropInPaymentMethodComponents: [
                Card,
                Bancontact,
                Ach,
                AmazonPay,
                ApplePay,
                BcmcMobile,
                BacsDirectDebit,
                CashAppPay,
                EPS,
                GooglePay,
                Klarna,
                PayByBank,
                PayPal,
                SepaDirectDebit,
                Trustly,
                Twint,
                PayByBankUS,
                Redirect,
            ],
        }),
    );
}

/** What {@link loadAdyenSdk} resolves to, for callers that hold on to part of it. */
export type AdyenSdk = Awaited<ReturnType<typeof loadAdyenSdk>>;
