import { STRIPE_SCRIPT_URL } from './PaymentIntegrationFormStripe.constants.ts';

/**
 * Static HTML loaded into the Stripe iframe via the srcdoc attribute.
 *
 * Stripe's PaymentElement cannot mount inside a closed shadow root because its
 * postMessage routing relies on document.querySelector to find the container.
 * Running Stripe inside an iframe's own document avoids that boundary entirely —
 * the iframe is a normal inline block element from the shadow DOM's perspective.
 *
 * Configuration (public key, elements options) is sent via stripe:init after
 * the iframe loads. All events are returned to the parent via postMessage.
 */
export const STRIPE_FRAME_SRCDOC = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { overflow: hidden; }
</style>
</head>
<body>
<div id="stripe-root"></div>
<script src="${STRIPE_SCRIPT_URL}"><\/script>
<script>
(function () {
  let stripe, elements, paymentElement, resizeObserver, countryCode, email, name, parentOrigin;

  // An opaque origin serialises as 'null', which postMessage refuses as a target. The parent
  // checks that what it receives comes from this frame.
  function parentTarget() {
    return parentOrigin === 'null' ? '*' : parentOrigin;
  }

  // Every submit is answered, or the page waiting on it never stops waiting.
  function postSubmitError(error) {
    parent.postMessage({
      type: 'stripe:submit:error',
      error: {
        message: error && error.message ? String(error.message) : 'Stripe submission failed',
        type: error && error.type,
        code: error && error.code
      }
    }, parentTarget());
  }

  window.addEventListener('message', function (event) {
    if (!event.data || typeof event.data !== 'object') return;
    if (event.source !== window.parent) return;

    if (event.data.type === 'stripe:init') {
      parentOrigin = event.origin;
      const initId = event.data.initId;
      countryCode = event.data.countryCode;
      email = event.data.email;
      name = event.data.name;
      // A second Payment Element would mount beside the first, and the submit would go to it empty.
      if (paymentElement) paymentElement.destroy();
      stripe = Stripe(event.data.publicKey);
      elements = stripe.elements(event.data.options);
      paymentElement = elements.create('payment', { layout: { type: 'accordion', defaultCollapsed: false }, wallets: event.data.options.wallets, fields: event.data.options.fields });

      paymentElement.on('ready', function () {
        parent.postMessage({ type: 'stripe:ready', initId: initId }, parentTarget());
      });

      paymentElement.on('change', function (e) {
        parent.postMessage({ type: 'stripe:change', paymentMethodType: e.value.type }, parentTarget());
      });

      paymentElement.on('loaderror', function (e) {
        parent.postMessage({
          type: 'stripe:loaderror',
          error: { message: e.error.message, type: e.error.type }
        }, parentTarget());
      });

      paymentElement.mount('#stripe-root');

      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(function () {
          parent.postMessage({
            type: 'stripe:resize',
            height: document.documentElement.scrollHeight
          }, parentTarget());
        });
        resizeObserver.observe(document.documentElement);
      }
    }

    if (event.data.type === 'stripe:update') {
      if (!parentOrigin || event.origin !== parentOrigin || !elements) return;
      const updateElements = elements;
      const updateOptions = event.data.options;
      // A failed update leaves the element showing the old amount; the parent sets it up anew.
      Promise.resolve().then(function () {
        return updateElements.update(updateOptions);
      }).catch(function () {
        if (updateElements !== elements) return;
        parent.postMessage({ type: 'stripe:update:error' }, parentTarget());
      });
    }

    if (event.data.type === 'stripe:submit') {
      if (!parentOrigin || event.origin !== parentOrigin) return;
      const submitCountryCode = 'countryCode' in event.data ? event.data.countryCode : countryCode;
      const submitEmail = 'email' in event.data ? event.data.email : email;
      const submitName = 'name' in event.data ? event.data.name : name;
      // A setup anew while this submit is in flight replaces both; the token comes from the
      // elements that were submitted.
      const submitStripe = stripe;
      const submitElements = elements;
      if (!submitElements) {
        postSubmitError();
        return;
      }
      submitElements.submit().then(function (submitResult) {
        if (submitResult.error) {
          postSubmitError(submitResult.error);
          return;
        }
        const billingDetails = {};
        if (submitCountryCode) billingDetails.address = { country: submitCountryCode };
        if (submitEmail) billingDetails.email = submitEmail;
        if (submitName) billingDetails.name = submitName;
        const tokenParams = Object.keys(billingDetails).length
          ? { payment_method_data: { billing_details: billingDetails } }
          : {};
        return submitStripe.createConfirmationToken({ elements: submitElements, params: tokenParams }).then(function (tokenResult) {
          if (tokenResult.error) {
            postSubmitError(tokenResult.error);
            return;
          }
          parent.postMessage({
            type: 'stripe:submit:success',
            confirmationTokenId: tokenResult.confirmationToken.id
          }, parentTarget());
        });
      }).catch(postSubmitError);
    }
  });
})();
<\/script>
</body>
</html>`;
