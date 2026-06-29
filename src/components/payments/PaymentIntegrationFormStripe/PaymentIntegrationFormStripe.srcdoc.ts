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
<script src="https://js.stripe.com/dahlia/stripe.js"><\/script>
<script>
(function () {
  var stripe, elements;

  window.addEventListener('message', function (event) {
    if (!event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'stripe:init') {
      stripe = Stripe(event.data.publicKey);
      elements = stripe.elements(event.data.options);
      var paymentElement = elements.create('payment');

      paymentElement.on('ready', function () {
        parent.postMessage({ type: 'stripe:ready' }, '*');
      });

      paymentElement.on('change', function (e) {
        parent.postMessage({ type: 'stripe:change', paymentMethodType: e.value.type }, '*');
      });

      paymentElement.on('loaderror', function (e) {
        parent.postMessage({
          type: 'stripe:loaderror',
          error: { message: e.error.message, type: e.error.type }
        }, '*');
      });

      paymentElement.mount('#stripe-root');

      new ResizeObserver(function () {
        parent.postMessage({
          type: 'stripe:resize',
          height: document.documentElement.scrollHeight
        }, '*');
      }).observe(document.documentElement);
    }

    if (event.data.type === 'stripe:submit') {
      if (!elements) return;
      elements.submit().then(function (submitResult) {
        if (submitResult.error) {
          parent.postMessage({
            type: 'stripe:submit:error',
            error: {
              message: submitResult.error.message,
              type: submitResult.error.type,
              code: submitResult.error.code
            }
          }, '*');
          return;
        }
        stripe.createConfirmationToken({ elements: elements }).then(function (tokenResult) {
          if (tokenResult.error) {
            parent.postMessage({
              type: 'stripe:submit:error',
              error: {
                message: tokenResult.error.message,
                type: tokenResult.error.type,
                code: tokenResult.error.code
              }
            }, '*');
            return;
          }
          parent.postMessage({
            type: 'stripe:submit:success',
            confirmationTokenId: tokenResult.confirmationToken.id
          }, '*');
        });
      });
    }
  });
})();
<\/script>
</body>
</html>`;
