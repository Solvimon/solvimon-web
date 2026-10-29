# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- An element accepts a portal object whose `authentication` is `SIGNED_TOKEN`, which carries a handle in `token` instead of a portal token. The element exchanges the handle at `POST /v1/portal/token` for a token that lasts as long as the link, with no refresh, and exchanges it again once when the API rejects that token. The handle is returned only when the portal URL is created, so pass on the `token` from the create response. Portal objects that sign in through identity work as before.
- A link that has expired, was revoked or whose checkout session has closed shows the element's "no longer available" notice, and logs `PORTAL_URL_EXPIRED` or `PORTAL_URL_REVOKED` (error), or `CHECKOUT_SESSION_CLOSED` (warning, with the session's `status` in `context`). When the API cannot verify the link, the exchange is retried a few times before the element logs `PORTAL_TOKEN_UNAVAILABLE` (error) and offers a "Try again" button (`sv-portal-unverified`). These are new members of the exported `ErrorCode` and `WarnCode` unions.
- A host that already exchanged the handle can pass the response it got, as it is, as `portalToken`, on the element or in `createScreen` / `createComponent`, and the element signs in with it instead of exchanging the handle again. When the API rejects that token, the element exchanges the handle. It is an object, so the token never becomes an HTML attribute of the element.
- A failed API call's `ApiError` carries the API's own error code as `errorCode`, and for a closed checkout session link its status as `checkoutSessionStatus`.
- The customer overview can show a **Shipping addresses** block below the billing information, for a customer with a subscription, of any status, that ships to a shipping address (`default_shipping_address_id`). To find out, the overview first looks at the active subscriptions it loads anyway, and otherwise reads the customer's subscriptions of every status from `GET /portal/pricing-plan-subscriptions` page by page, without holding up the rest of the screen; only for such a customer are the addresses loaded and the block's code downloaded. It lists up to three of the customer's addresses in one card, the default first and marked **Default**, each with a menu to **Edit** or **Delete** it; with none it says **No shipping addresses yet**, with an **Add shipping address** link that opens the modal on the form. **Manage** opens a modal with every address and the same menu, and **Add shipping address** at the bottom. Adding or editing slides to a form with the checkout's shipping fields (the country just above the address lines, below the recipient), a new address starting on the customer's country and name and an edited one on what is stored. An organization is asked for the company name it ships under, starting on its legal name. Edit and Delete from the block's menu open the modal on that step and close it once done. The addresses come from `GET /portal/shipping-addresses`, and only `ACTIVE` ones are shown; adding one is `POST /portal/shipping-addresses` with `status: 'ACTIVE'`, so it is listed straight away (the portal cannot activate a draft afterwards), an active address cannot be changed, so saving an edit stores it as a new active address and then retires the old one through `deprecate`; saving again after a failure carries on from where it stopped, with any correction made since saved onto the new address, and deleting retires it through `POST /portal/shipping-addresses/{id}/deprecate`. Failures are logged as `SHIPPED_SUBSCRIPTIONS_LOAD_FAILED` (the block is then left out), `SHIPPING_ADDRESSES_LOAD_FAILED`, `SHIPPING_ADDRESS_SAVE_FAILED` and `SHIPPING_ADDRESS_DELETE_FAILED`. The modal and the form are loaded only once the customer opens them.

### Changed

- The checkout screen shows the terms and conditions in the order summary column, centred under the secure payments line next to the pay button, instead of in a footer below both columns.
- `ContentWithAsideLayout` no longer takes a `footer` slot; the checkout terms were its only content.
- `@solvimon/solvimon-ui` is 1.20.2 and `@solvimon/solvimon-types` 1.10.0. Tab now moves through the fields of a modal instead of jumping back to its close button.
- The buttons in the customer overview's section headers (**View all**, **Edit** and **Manage**) are extra small, a step down from small.

### Fixed

- The checkout description and an enabled pricing's price name the billing period in the element's language, "per dag" in Dutch rather than "per day".
- The **My subscription** and **Payment method** blocks on the customer overview were a darker gray than the billing information next to them: their title wrapper laid its own translucent gray under the cards. They now have the same single gray background.

## [0.1.0-alpha.28] - 2026-10-21

### Added

- A payment whose outcome is not known yet is no longer reported as failed. A bank debit such as SEPA that is still processing, an authorization answered with a pending payment, and a payment call that got no answer or failed with a 5xx used to show "Payment failed" with a "Try again" button, so a customer whose payment was on its way could pay a second time. The customer is now told the payment may still go through and not to pay again, with no retry, and checkout and the pay invoice screen keep the pay button and the express payment methods off. It is logged as `PAYMENT_OUTCOME_UNCONFIRMED` (warning), and a `payment-failed` event for it carries that code instead of `AUTHORIZATION_FAILED`. Only a call the API turned down (a 4xx) still counts as a failed payment.
- When checkout cannot keep its form for a payment redirect, for example because session storage throws, it logs `CHECKOUT_FORM_STATE_NOT_SAVED` as a warning and the pay button no longer stays pending.
- An element that is missing `environment`, `portalObject` or the id its `configuration` needs (`invoiceId` for `invoice`, `invoice-header`, `invoice-details`, `payment-history` and `pay-invoice`; `subscriptionId` for `subscription-details`, `subscription-schedules` and `subscription-management`) renders nothing until they are set, and logs `MISSING_REQUIRED_PROPERTIES` as a warning, with the missing names in `context.missing`, if they are still missing just after it mounts.
- The invoices list marks a credit note with a "Credit note" chip where an unpaid invoice shows its Pay button, and a voided invoice, should one be listed, with a "Void" chip.
- The invoices list says so when its invoices, or the next batch of them, fail to load (`sv-invoices-list__error`); "Load more" stays to try again. The invoice, invoice header, invoice details and payment history components say so too when their invoice fails to load, instead of rendering nothing.
- `UNSUPPORTED_LOCALE` (warning) is logged when an element is given a locale the SDK has no translations for, such as `nl` or `en-GB`; the element renders in `en-US` as before. `PORTAL_TYPE_NOT_ALLOWED` (error) is logged when an element is given a portal object of a type it does not accept. Both are new members of the exported `WarnCode` and `ErrorCode` unions, so a `switch` over them that must be exhaustive needs a case for each.
- The README documents the `action-request` event, its actions, and which properties an element follows after it has mounted.
- The payment methods screen's "Your payment methods", "Add payment method" and "Cancel" are translated, under the message ids `screens.payment_method_management.list_title`, `screens.payment_method_management.add_button` and `screens.payment_method_management.cancel_button`. The pay button names card payments under `pay_button.payment_method.card` ("Credit Card"). A `messages` override can replace any of them.
- The checkout collects a shipping address for orders that are shipped. The portal says whether an order is — `use_shipping_addresses` on the checkout page's portal url — and the form then asks, under "Shipping information", for the email and the shipping address (the destination country first, then who receives the parcel — a first and last name, or a contact person on a company purchase — where it goes, and a phone number the carrier can reach the recipient on), and for the billing address in a section of its own, behind a "Billing address is the same as shipping address" checkbox that is ticked to begin with. While it is ticked, the billing address follows the shipping one; unticking it asks for a separate billing address. The invoice preview and its tax are priced at the shipping address either way, while the customer the order is placed against keeps the billing address, and its billing country decides whether a VAT number counts. A paid shipped order shows the address it ships to. The shipping address follows the destination country, from Google's address data (the data Chrome autofill uses): it shows only the fields the country uses, so there is no postal code for Hong Kong, and requires what the country requires, such as a state in the US and Canada. A postal code has to match the country's format and is sent in capitals, and a phone number needs 7 to 15 digits. A person's last name and the phone number are always required, and the order cannot be paid for until the address is complete. Every text field carries an `autocomplete` hint, so a browser can fill in both addresses; the country selects do not take one yet. The country data is loaded only on a checkout that ships. The payment sends it as `shipping_address_details` in the authorization context, and the API links it to the subscription the checkout creates. A checkout without the setting asks for a billing address alone, as before, apart from the placeholders and spacing below.
- The subscription card on the customer overview now carries the actions the design gives it: **Upgrade**, which asks the host for the subscription management flow through the existing `manage-subscription` action, and **Cancel**, which opens the cancellation modal on the card itself rather than sending the customer to the subscription details screen first. A subscription that has already been cancelled offers **Renew** in the same place. Both are on by default and can be turned off per block with `showUpgradeButton` and `showCancelButton`. The cancellation modal is loaded only once a customer opens it, so the overview does not carry its weight for everyone. `showViewDetailsButton` now defaults to `false`: the card leads with Upgrade, and the details button is opt-in.
- The manage subscription screen now also moves a subscription between plans. Where the plan it runs on belongs to an `ACTIVE` pricing plan group, the screen offers that group's plans above what the plan itself can be customised with, cheapest first, with the current one marked. The group owns the timing and the screen says it on each option — a move that starts right away, or one that starts at the next billing period — and a transition the merchant has closed off (`NOT_ALLOWED`) is not offered at all. The group is read from `GET /portal/pricing-plan-subscriptions/{id}/pricing-plan-group`, expanded so each member carries its plan; a subscription whose plan is in no group answers 404, which the screen reads as nothing to offer rather than as a failure. Picking another plan commits through `POST /portal/pricing-plan-subscriptions/{id}/change-plan` with the target plan and nothing else, so the group's own timing decides when the move lands; keeping the current plan still starts a new schedule with the pricings that are enabled, exactly as before. A plan that belongs to no group, or whose group is not active, renders the screen as it did. The aside says when the move takes effect and prices it in the order summary through `POST /portal/invoices/change-plan/preview`, sent the same target plan with the subscription: the invoice raised where the new plan starts, settling the plan being left. As with a change on the current plan, the move can only be committed once that price has loaded. The submit button reads **Upgrade plan** for a plan higher in the group and **Downgrade plan** for a lower one. With the current plan selected it reads **Your current plan** until a pricing on it is changed, and **Update subscription** after that. A preview that fails logs `INVOICE_PREVIEW_FAILED` with `preview: PLAN_CHANGE`.

### Changed

- `SubscriptionManagement` is titled "Manage subscription" whichever group it changes. It named the group being changed, as in "Manage Credit packs", which no longer fits a screen that also moves the subscription between plans and cancels it. The message id `subscription_management.title` takes no `{subject}` any more, and `subscription_management.title.default_subject` is gone; a `messages` override for either should be updated.
- The cancellation modal no longer marks the subscription's payment method as the customer's default; whether it is has no bearing on cancelling or renewing.
- The checkout's toggles are one size smaller (`sm`), and its pay button is `md` (40px) instead of `lg` (48px).
- The checkout form's placeholders lose their trailing "...", the billing country select says "Billing country" until one is picked, and its fields sit 8px apart and its sections 16px apart.
- Moved to `@solvimon/solvimon-ui` 1.19.0, for its phone number input and fields that keep their label for screen readers only.
- Browsers can autofill the checkout form and the billing information form. Their fields used to be marked `autocomplete="off"`, the default of the UI's inputs; the email, name, company name and address fields now carry the matching `autocomplete` hint, with `billing` and `shipping` keeping the two addresses apart. The VAT number stays off. The country still has to be picked by hand, because the country select does not take a hint yet.
- An element shown in `en-US` no longer downloads any translations before it renders. Its messages are the defaults already in the bundle, so it renders, and starts its requests, one network round-trip sooner, and downloads about 11 KB (gzip) less. Other locales load as before.
- `@adyen/adyen-web` is no longer a dependency, so installing the package no longer installs it, `preact` and Adyen's type packages, about 19 MB. The SDK has always used its own bundled copy of Adyen; the installed one only supplied two type names to the published declarations, which now carry them. A host that uses Adyen itself has to depend on it directly.
- Installing the package no longer installs `vite-bundle-visualizer` and the 29 packages it depends on. It was declared as an optional dependency, which npm installs for every consumer, although only this repository's `analyze` script uses it.
- Moved to `@solvimon/solvimon-ui` 1.14.3. It no longer bundles its own copy of Vuelidate, so the forms use the `@vuelidate/core` the SDK already depends on.
- A promotion code the API turns down, such as one that does not exist, is a customer's mistake rather than an SDK failure. It is now logged as `PROMOTION_CODE_REJECTED` (warning) instead of `PROMOTION_CODE_APPLY_FAILED` (error), and the invoice preview request it failed logs `REQUEST_FAILED` as a warning instead of an error. `PROMOTION_CODE_REJECTED` is a new member of the exported `WarnCode` union.
- `STRIPE_REDIRECT_RETURN_FAILED` is now also logged when the payment a Stripe redirect returned from cannot be retrieved from Stripe.
- The SDK takes the payment redirect parameters out of the page address once it has handled a return, with `history.replaceState`: `payment_acceptor_id`, `redirectResult`, `redirect_status`, `payment_intent`, `payment_intent_client_secret`, `setup_intent` and `setup_intent_client_secret`. An Adyen return is cleared right away, a Stripe one once Stripe has answered. A host that reads these parameters must do so before the SDK's screen or component mounts.
- A Stripe error passed to `onLog`, written to the console or carried by `payment-failed` now holds only its `code`, `type` and `message`. It used to be passed on whole, and could carry the payment or setup intent with its client secret.
- `INVALID_EMAIL` no longer includes the rejected email address in its message, which now reads `invalid email provided`. The email the host passes to checkout is checked with the same rule as the email field, so an address the field would reject, such as one with an underscore in its domain, is dropped and reported as well.
- `SubscriptionManagement` offers only the subscription's own payment method, which is the one the API charges a change to, and no longer offers to add one. It used to let the customer pick or add any method and then charge the subscription's method regardless. The method is only offered while the API accepts it: active, of the subscription's customer, and not prepaid or of an unknown type. A subscription without such a method says so, the disabled Update button points at that message, and it cannot be changed.
- `SubscriptionManagement` no longer changes a subscription that has pricing customized for it, and says to contact support instead. A new schedule carries none of the customizations, so any change, to whichever group, dropped them, and moving off a customized pricing could not be priced. `SubscriptionDetails` still lists such a pricing under Upgrades at its customized price, but offers no Upgrade action while the schedule has customized pricing.
- The `manage-subscription` action request carries `data.enabledPricingId` when the customer chose Upgrade on a pricing in `SubscriptionDetails`. Pass it to `SubscriptionManagement` as `configuration.enabledPricingId` to open on that pricing's group.
- The billing information block's Edit button has a message id of its own, `customer_overview.billing_information_block.edit_button_label`. It used `customer_overview.billing_information_block.view_all_payment_methods_link_label`; a `messages` override for the old id no longer applies, so move it to the new one.
- The checkout's `error` event is typed with an `Error` as its payload, like every other element's. It was typed as `{ title, message }`, which nothing ever sent.
- An element given a portal object meant for another element logs `PORTAL_TYPE_NOT_ALLOWED`, once, and dispatches it as an `error` event. The checkout logged `INVALID_TOKEN` for it.
- An error the UI library recovers from by itself, such as a date it can only format in the browser's own time zone, is logged as the warning `UI_COMPONENT_RECOVERED` rather than as `UNHANDLED_ERROR`.
- A JSON response that cannot be parsed is logged once, as `REQUEST_PARSE_FAILED` with the request's `path`, `method`, `statusCode` and `requestId`. It used to be logged a second time as `REQUEST_FAILED`, and without that context.
- The wallet balances block offers Top up, Automatic top-up and Cancel only where it can open them. The standalone `<solvimon-wallet-balances>` component no longer shows these buttons, which did nothing there; the customer overview and subscription details screens still offer them. On the subscription details screen, a wallet offers only the top-ups billed on that subscription.
- The wallet balances block now emits `payment-failed` when a top-up charge fails, and `auto-top-up-saved` when an automatic top-up rule set up alongside a top-up is saved, so the host can reload the wallet.
- The top-up modal's "Between {minimum} and {maximum}" line is gone: the bounds now sit beside the amount field's new "Amount" label. Its message id, `topup_modal.flexible_option.bounds`, is no longer used, so a `messages` override for it no longer applies.
- The invoices list caps `pagination.batchSize` at the documented maximum of 50, and at a minimum of 1. A value that is not a number, such as a string passed from plain JavaScript, falls back to the default of 15.
- The payment history lists its attempts in the order it shows them, and the invoice's wallet balance table toggles each row with a button that reports whether it is expanded, so screen readers read and operate both as they appear.
- Each invoice row's button now has an accessible name, "View invoice {invoiceNumber}" (`invoice_table.row.view_invoice_aria_label`).
- The invoice PDF download asks for `Accept: application/pdf` and sends no `Content-Type`, instead of sending `application/pdf` as its `Content-Type`.
- A request the API rejects with a 401 is now retried once with a renewed access token. It fails and logs `REQUEST_FAILED` only when no renewed token can be had, or when the retry is rejected too. Requests also wait for the token to be refreshed first when it is within a minute of expiring. However many requests need a new token at once, they share one refresh. After a refresh fails, requests do not start another one; instead the refresh is retried every 30 seconds, and when the tab becomes visible, until one succeeds. This holds even when the token is still far from expiring. Hosts may therefore see fewer `REQUEST_FAILED` entries with a 401 status. `SESSION_EXPIRED` still means the session cannot be renewed and the host has to issue a new portal token.
- The SDK now judges when the access token expires from `expires_in` on the identity response instead of the token's `exp` claim, so a client clock that is set wrong no longer makes it refresh too early or too late.
- Checkout reads a `coupon_code` query parameter only when it could be a code. It trims the value and ignores it when it is empty, longer than 256 characters, or contains whitespace or invisible or control characters, such as a zero-width space. A `couponCode` set in the `configuration` is used as given.
- An element renders only for a published portal object of the type it accepts — `INIT_PRICING_PLAN_SUBSCRIPTION` for the checkout, `CUSTOMER` for every other element — and, for any other, makes no API call at all, not even the token exchange. A revoked portal logs `RESOURCE_REVOKED`; the checkout shows its "Checkout not available" notice, and the other elements, which used to render and call the API with it, say that they are no longer available (`sv-portal-unavailable`). Another type logs `PORTAL_TYPE_NOT_ALLOWED` and renders nothing; the checkout used to throw on one and log `INVALID_TOKEN`.
- Each element's `define` function returns the tag name the element is registered under. Calling it again returns that name rather than registering another.
- `@import` rules are removed from `cssOverrides`. Browsers that adopt stylesheets ignored them and the others loaded them; load fonts and other stylesheets from the host page.
- Fewer API requests: the pay invoice screen no longer loads payment methods it does not show, and the subscription cancellation modal shows the payment method `SubscriptionDetails` already loaded instead of listing them all again. A pricing with an empty name is now labelled by its product's name in subscription summaries.

### Removed

- The CommonJS build. The package is published as ES modules only. On Node 20.19 or later, `require()` still works, because Node loads the ES modules directly. A Jest setup that does not transform ES modules needs `@solvimon/solvimon-web` added to its `transformIgnorePatterns` exceptions. Bundlers that loaded the CommonJS build bundled every screen and component up front; the ES build loads each one only when it is used.

### Fixed

- After returning from a payment redirect, checkout's seats and one-time item steppers can be lowered again. The quantities the customer had chosen became the lowest the steppers allowed, so a customer who had raised them before paying could only raise them further. The lowest is the order's quantity again, matched to each seat or item by its config rather than its position in the list. A restored quantity below the order's is raised to it, and a config the restored form lacks keeps its row.
- Checkout on a plan that offers a single billing period no longer fails at Pay with `billing_period is required when the pricing plan version has billing period settings configured`. The billing period was only sent when the plan offered more than one, but the API needs it whenever the plan has billing period settings. The invoice preview now sends it too, so it prices what is charged.
- The published type declarations type-check in a project that does not set `skipLibCheck`. Two of them imported `@solvimon/solvimon-ui`, which a consumer cannot install, and reported `Cannot find module`; the provider props they need now ship with the package. A helper type copied from the Solvimon types reported `Generic type 'Optional' requires 2 type argument(s)`.
- A return from a Stripe redirect counts as paid only once Stripe says the payment succeeded. It was read from the address alone, so typing the redirect parameters into it showed the payment as paid and fired `payment-success`. The payment form stays away while the payment is checked, so the customer cannot pay again meanwhile.
- Checkout handles a return from a payment redirect like any other payment: `onPaymentSuccess` is called and `success_url` is followed. It marked itself paid from the address before the payment form could confirm the payment, so neither happened and the customer had no way on.
- The Adyen drop-in no longer spins for good after 3DS or another additional-details step: a refused payment now shows as refused. A successful return from an Adyen redirect shows the completed card, and a refused one shows its failure instead of an empty payment section.
- The pay invoice screen shows the invoice as paid and takes the pay button away once a payment succeeds, and reloads the invoice. "Pay" stayed enabled on an invoice that had just been paid.
- An Apple Pay payment that got no answer, failed with a 5xx or is still pending no longer tells the customer to try again; checkout says it may still go through and not to pay again.
- The pay button no longer keeps spinning after a payment that was never sent. With Stripe, a press before the payment form was ready or a submit Stripe rejected left it waiting for good; with Adyen, so did closing a wallet's payment sheet or the PayPal popup. The button now comes back, in checkout, the pay invoice screen and the payment method form. A Stripe payment submitted just as its form was set up anew, for example after a change of amount, is no longer refused by Stripe.
- Checkout keeps the pay button off while its payment methods failed to load, when there is no payment form to pay with. Going back to a country whose payment methods were already loaded now clears a load failure of the country in between, so the error card goes and "Try again" works.
- Calling `submit()` on the payment method form while it is still loading no longer leaves it pending for good.
- An Adyen 3DS challenge is shown once. It could be shown twice, and the second verification reported "Payment failed" after the payment had gone through. The customer can now click the challenge while the payment is pending; the payment form was dimmed and did not take clicks.
- A customer can no longer pay twice with Adyen by pressing Enter in a card field, or the drop-in's own PayPal button, and then Pay, or by paying through a second payment method on the same screen while the first payment is on its way. Checkout, the pay invoice screen and the payment method form hold their pay button as soon as any payment starts, and checkout keeps its form for a redirect that such a payment leads to.
- An Adyen redirect return is confirmed once, by the payment form of the payment acceptor it names. A reload sent the spent result to Adyen again, "Try again" on the error card reloaded the page and so could never retry, and with several Adyen payment methods each one confirmed the same return. "Try again" now starts the form over in place. A redirect result that is not one Adyen could have issued is not sent, and is reported as unconfirmed.
- Coming back from 3DS while storing a payment method now confirms the method; the form that handles the return only opened after "Add payment method" was pressed.
- Only one Adyen drop-in is shown when the payment form is rebuilt while it is still loading, and no drop-in is built while a returned payment is being confirmed, so a second payment cannot start before the first is known.
- The Stripe card form keeps what the customer typed when the amount changes, for example after a promotion code, a seat change or a new country. Stripe's payment form was mounted a second time beside the first, so the customer lost the card details and Pay submitted the empty form. The billing country on the payment is the one chosen last.
- The Stripe payment form now loads on a page sandboxed without `allow-same-origin`; it was never set up there. The publishable key, email and name are now posted to the Stripe frame for the page's own origin only, rather than for any origin, except on a page whose origin is opaque.
- The frame that holds the Stripe payment fields has an accessible name, "Payment form", in the customer's language.
- Checkout charges the price of the order as the customer last changed it. An invoice preview that answered after a later one replaced it, so the amount paid could come from earlier seats or another country, and a change made in the same moment as another, such as an email typed while the country changed or the country filled in from the customer's location, was not priced at all. Pay now also waits for the preview.
- Checkout offers the payment methods of the country chosen last. A slow lookup for a country the customer had left could replace them and authorize the payment through that country's payment acceptor, and a failed lookup the customer had moved on from kept the error card and the pay button off.
- A promotion code that the latest invoice preview turns down is no longer shown as applied, and removing a code while it is still being applied no longer says it could not be applied.
- Checkout no longer fills in a later visit, or another plan, with the previous customer's details, seats and add-ons. The form is kept per subscription for a payment redirect only, restored on a return within the hour, and cleared once the payment ends on the page. A restored promotion code shows in its section, the email the host passes is not overwritten, and saved values that do not fit the form or the plan are dropped in favour of the plan's own.
- The failures of loading payment methods in checkout, and of loading on-demand items for a subscription that moved on to another schedule, are logged with their error; they were logged with none.
- Checkout requires the legal name on a company purchase and shows when it is missing. The check never applied, so a company purchase went through with an empty legal name.
- Checkout no longer blocks the pay button on a VAT number the customer cannot see. A VAT number typed on a company purchase was still checked after switching back to an individual purchase, or to the US, where the field is hidden, so submitting did nothing and showed no error. Such a VAT number is also no longer sent with the invoice preview or the payment; it stays in the form and is sent again once the field is shown.
- The checkout postal code shows its own error. It showed address line 1's, so in the US a missing postal code went unflagged once the address was filled in, and a filled-in postal code was flagged when the address was missing. Postal code and state errors now show below the field, keeping the three fields on one row.
- The checkout's VAT check result now clears when the VAT number, country or legal name changes, and a check answered after such a change is ignored. When the EU VAT service cannot give an answer, or the check fails, checkout says the VAT number could not be checked right now, instead of calling it invalid.
- Address line 2, postal code, city and state carry a label for screen readers, in the customer's language, in checkout and the billing information form; they had only a placeholder.
- Checkout no longer charges the price from before the customer's last change. The price is loaded 200ms after a change to the seats, add-ons, country or another field that prices the order, and paying within that time authorized the previous amount and currency against the new order. The pay button now stays off until the new price has loaded, and every way to pay, including Enter in a card field and the express payment sheet, first waits for the price of the form as it is. If that price cannot be loaded within 10 seconds, the payment is not sent, checkout says so and the pay button is released; a change made while the payment waits is followed, and if the order changed again by then, checkout says the price changed instead. Once the price has settled, the plan, the customer details and the promotion code are locked until the payment goes through or fails, and the amount and order sent are the ones from that moment, so a change made while a card gateway creates its token is no longer authorized at the price from before it.
- `SubscriptionManagement` prices a change on the schedule that is billed now. From the second change on, it priced the change on the first schedule the subscription ever had, which had ended.
- `SubscriptionManagement` only commits a change the customer has made and seen the price of. It could commit while the price was still loading or had failed, and committing what the subscription already had started a duplicate schedule. It shows an error when the subscription cannot be loaded and says so when there is nothing to change, where it showed an empty page. The form is locked while the change is committed, and Enter in the form commits it.
- `SubscriptionDetails` lists the upgrades, and the cancel confirmation names the pricings, of the schedule billed now rather than one that has yet to start.
- A pricing customized for the subscription is listed under Upgrades at its customized price, and `SubscriptionManagement` finds its group, so it says the subscription has custom pricing instead of that there is nothing to change. Both looked it up on the plan, where it does not exist under the id the subscription bills it by, so it was left out.
- `SubscriptionDetails` offers Renew only for a cancellation that has yet to take effect, and Cancel whenever the subscription is active and not already cancelled. A pending plan change counted as a cancellation: it showed Renew, which asked the API to undo the plan change, and hid Cancel. Neither button is shown for a subscription that is no longer active or is not a `BILLING` subscription, which the API refuses both for.
- The cancel and renew confirmation dates the end of the billing period and the renewal deadline in the customer's timezone, as the subscriptions list does, where it used the browser's. Its copy no longer switches while it closes, and the cancel confirmation is dismissed with "Keep subscription" rather than "Cancel".
- `SubscriptionDetails` keeps the subscription on screen when reloading it after a cancel or renew fails, where it replaced the screen with "Unable to load this subscription" next to the confirmation.
- `SubscriptionsList` and the subscriptions block of `CustomerOverview` say so when the subscriptions cannot be loaded, where they showed "No subscriptions". A failed load no longer leaves the block loading for good.
- `SubscriptionsList` shows a "Load more" button while there are more subscriptions, where it showed only the first 15.
- The cancel confirmation names each enabled pricing once, where a pricing offered on more than one schedule was named once per schedule.
- The billing information form saves the customer's edits. Its Save button stayed disabled whatever the customer changed, and its checks looked at the values the form started with. After a save, the form starts again from the details as saved, so Save turns off and the details show as the API stored them. A second press while a save is running is ignored.
- The billing information form says why a save failed. An API error shows on the field it names, including the email field, or as a general error when the form does not show that field; a failed save showed nothing.
- The billing information form checks the country, legal name, VAT number and the address fields the country needs, with the rules checkout uses. Emptying the VAT number removes it from the customer.
- Saving the billing information form leaves the customer's stored tax ids alone unless the VAT number was edited. Every save replaced them all with the first one, retyped as a generic tax id, and a stored tax id outside the EU, such as a Canadian GST/HST, Australian GST or US one, blocked every save. An edited VAT number now changes only the first tax id and keeps its type.
- The `error` event now fires. An error an element does not handle itself, thrown while it sets up, renders, watches or handles an event, is logged as `UNHANDLED_ERROR` and dispatched as an `error` event on the element, with the `Error` as the first item of `event.detail`. Such errors used to reach neither `onLog` nor the event.
- An element mounted before its required properties were set, as plain HTML does when a script sets them after `define()`, renders once they arrive. It used to throw while setting up and stay blank for good. The same goes for the invoice components without a `configuration.invoiceId`.
- An unknown `environment` is reported through `onLog` and the `error` event instead of only to the console.
- The `log` and `action-request` events, and `cssOverrides`, work from the moment an element starts rendering. Entries logged while it rendered for the first time used to reach `onLog` without a `log` event, and an action requested then went ahead without an `action-request` event the host could cancel.
- An `onLog` callback that throws no longer replaces the error being logged, or stops the other log outputs. Its error is rethrown outside the SDK, where the page's own error reporting sees it.
- The `billing-information-form` component logs a customer that fails to load as `INITIAL_DATA_LOAD_FAILED`.
- A save the `billing-information-form` component is refused, a default payment method the API refuses, and a failed reload of the payment methods after subscription management stores one are reported once, as `REQUEST_FAILED`. They also escaped as unhandled promise rejections.
- The logger reads `onLog`, `logLevel` and `environment` each time it logs. An element whose properties were set after it was appended never called that `onLog`, and kept writing to the console with `environment` missing from its entries even once it was set to `LIVE`.
- `UNHANDLED_ERROR` entries carry the `componentName`, `environment` and `url` every other entry has, so a page with several elements can tell which one failed.
- The top-up modal checks the amount the customer chooses, and says under the field why it was refused: empty, zero or less, or outside the item's minimum and maximum. Such an amount was sent to the API, or silently refused.
- A top-up is charged on the schedule of the top-up item the customer chose, and an automatic top-up rule set up with it is billed on that schedule too. It was charged on the first item's schedule, so a wallet shared by several subscriptions could bill the wrong one.
- The top-up modal says when a top-up fails, telling a declined payment apart from any other failure; the spinner just stopped. When the automatic top-up rule set up with a top-up could not be saved, the receipt now says so, and Done waits until that save is over.
- The automatic top-up modal shows why a rule could not be saved, and turns Save off with a note when the wallet has nothing a rule can charge; Save did nothing. Its subtitle reads "auto top-up" instead of "auto top so", and the Dutch subtitle is complete.
- A switched-off automatic top-up rule no longer blocks the top-up with an error under a field the customer cannot see, and is no longer saved.
- Credits are converted to money with the minor units of the currency charged, such as none for JPY and three for KWD or BHD, instead of always two decimals.
- When the total of a top-up cannot be calculated, the modal says so instead of showing a loading placeholder for good, and a total that is about to change is dimmed until the new one arrives.
- Each wallet row opens its own wallet when a top-up item grants credit to several wallets; every row opened the first.
- A subscription with no name or reference is named after its plan, or "Subscription 2" and so on, in the top-up modal, instead of by its id.
- The invoices list no longer offers Pay on an invoice that cannot be paid. It only checked `paid`, so credit notes and invoices with nothing left open got a Pay button that led to a payment the API refuses. Pay now shows only for a `FINAL` invoice that is not a credit note, has an amount left open and is not paid by either `paid` or `payment_status`. The list only receives `FINAL` invoices from the API, so drafts, empty and voided invoices were never affected.
- The invoice details component no longer goes blank when the invoice's payments fail to load: it fetched payments it does not show, and a failure there discarded the invoice too. It now fetches only the invoice.
- The invoice, invoice header, invoice details and payment history components show their loading skeleton while the invoice loads, where they rendered nothing, and load the new invoice when `configuration.invoiceId` changes instead of keeping the first one.
- Invoice dates are given in the timezone the invoice was issued in (`invoice.timezone`) rather than the customer's current one, as the API does when it dates the invoice's periods: in the invoices list, and everywhere on the invoice and invoice header components, including the header, the summary's line periods, the invoice details and the wallet balance table. One invoice no longer shows a different date in its header than in its details. The customer's timezone is still used for an invoice without one.
- The invoices list's "Load more" button shows that it is loading while the next batch loads.
- A session no longer lapses in a background tab or after a laptop sleeps. The token was refreshed only by a 30-second timer, which browsers throttle in the background and which stops during sleep, so the first request afterwards failed with a 401. Requests now refresh an expiring token before they are sent, and the token is also checked when the tab becomes visible again. An access token without an `exp` claim was never refreshed at all; that is fixed too (DD-3547).
- A malformed portal token no longer leaves every later element with that token blank. The token was parsed after its shared session had been registered, and the failure threw before the cleanup hook was set up, so the session leaked and nothing was logged. The token is now parsed first, and a malformed one logs `INVALID_TOKEN` (DD-3547).
- `SESSION_EXPIRED` and `INVALID_TOKEN` now reach the elements still on the page. When several elements shared a portal token, these entries went to the `onLog` of the first element that mounted, even after it had been removed. Every mounted element that shares the token now receives them. The `REQUEST_FAILED` entry from a failed refresh goes to an element still mounted, or nowhere when none is (DD-3547).
- Ids the SDK puts in a request path, such as a customer, invoice, subscription or payment method id, are now sent as one encoded path segment. An id containing `/`, `?`, `#` or `..` could point an authenticated request at a different endpoint. An empty id, `.` or `..` now fails without sending a request.
- The checkout description no longer renders the price and billing period as HTML. They are shown as text, with the amounts still in bold.
- The README examples work: they passed a `token` attribute, which no element has, and so failed with `portalObject is required`. They now set `portalObject` as a property. The core README no longer shows a `token` option or a `sandbox` environment, and lists every registered id.
- Properties changed after an element has mounted take effect. A `portalObject` with another token or a new `environment` starts the element over with them; a new `invoiceId` or `subscriptionId` in `configuration` loads that invoice or subscription; `experimentalFeatures` apply in place; and a checkout `couponCode` set before the subscription has loaded is applied. Each was read once, when the element mounted.
- Mounting an element through `createSolvimonCore` after defining it under your own tag name — `defineSolvimonCheckout('acme-checkout')`, say — no longer throws `NotSupportedError`. The core mounts it under the name you chose.
- The payment method form uses the `countryCode` property it declares. It overrides the customer's country for the payment methods offered and the payment form; it was ignored.
- At exactly 640px wide, components that switch between a mobile and a desktop layout now use the desktop one, as their `sm:` styles already do. They used both at once.
- Checkout says a trial is "Free" however the API writes its zero amount; it only recognised `0.00`. Where it states a fallback amount, that amount is now in the checkout's own currency instead of always in EUR.
- The promotion code field tells screen readers a code is applied only once checkout has accepted it, and announces nothing for a code it turned down. Pressing Enter in the field applies the code once; it applied it twice.
- A checkout note no longer reads an underscore inside a word, such as `customer_reference_id` or a URL, as italics.
- The seat labels and prices are now in Dutch for the `nl-NL` locale ("Plaatsen", "per plaats"). They were shown in English.

## [0.1.0-alpha.27] - 2026-10-12

### Added

- Checkout tells one-time charges apart from the subscription when an invoice holds both, such as a plan that also sells hardware, shipping or a swap. The order summary lists them under "Subscription" and "One-time charges" headings, with a subtotal where a group has more than one row, and states what the subscription then renews at below the total. The plan editor heads its one-off items "One-time items" and prices each row "per unit, one-time". The description above the pay button and the agreement beside it state what is due today and, separately, what the subscription costs per period after that; for a plan billed on usage, they say that usage is billed every period. An invoice with only subscription charges reads as before. The one-off item price label's message id changed from `units.price_per_unit` to `units.price_per_unit_one_time`; a `messages` override for the old id no longer applies, so move it to the new one.
- When checkout cannot tell the recurring part of the invoice from the one-off part, for example because an invoice-wide discount applies, it logs `RECURRING_AMOUNT_UNRESOLVED` as a warning and falls back to its previous wording instead of naming a price per period.

### Changed

- The published build no longer carries `data-testid` attributes. Tests that select the SDK's elements by test id must use another selector.
- `jwt-decode` and `@stripe/stripe-js` are no longer dependencies of the package; their code was already bundled. The package now declares `engines.node` as `>=20.19.0`.
- Express payment methods (Apple Pay) are rendered only where the `express-checkout` flag is on.

### Fixed

- Checkout no longer presents one-time charges as a price per period. It labelled the whole first invoice "per month", so every one-off item raised the stated monthly price, and the express checkout passed that figure to Apple Pay as a recurring charge. The recurring amount now comes from the plan rather than the first invoice. An order with nothing that renews is shown and authorized as a one-time purchase. A plan billed on usage is still authorized as recurring, even when its first invoice carries no usage yet.
- The order summary's "+ Usage" note now appears at checkout for a plan billed on usage. It only appeared once usage had been reported, which never happens before checkout. Only add-ons and group items the customer selected count towards it.
- The billing period selector no longer counts one-time charges in its prices and "Save" badge. A one-off charge was counted twelve times on the monthly option and once on the yearly one, which overstated the savings. Each option now shows its recurring price.
- The express Apple Pay payment now creates the subscription it pays for and shows its outcome. It used to charge the customer without creating anything, show a refused payment as a success, and leave the sheet waiting when the checkout form was incomplete. It now passes the street and state from the Apple Pay contact to the checkout, and hides the button on devices that cannot pay with Apple Pay. A failed express payment tells the customer it did not go through.

## [0.1.0-alpha.26] - 2026-10-08

### Added

- The subscription details screen offers the subscription's on-demand items. When the subscription has any, an "Available on demand items" block (`sv-on-demand-items-card`) opens an order form (`sv-charge-on-demand-modal`) where the customer picks items, sees the total and pays with a saved or new payment method. To find them, the screen now requests `GET /portal/pricing-plan-schedules/{id}/on-demand-pricing-items` on mount for a `DEFAULT` subscription; if that fails, the block is left out and `ON_DEMAND_ITEMS_LOAD_FAILED` is logged.
- The subscription details screen takes an `onInvoiceCreated` callback in its `configuration`, called with `{ invoiceId, paymentStatus }` as soon as an on-demand order creates an invoice. The order creates an invoice whether or not its payment went through: `PAID` and `OVERPAID` are settled, while `UNPAID`, `PARTIALLY_PAID` and a missing status are an invoice still to be paid. An order that fails is not reported there; it reaches `onLog` instead, as described below.
- An on-demand order ends in one of three ways. When it is placed, the receipt says whether its invoice is paid or not paid yet; an unpaid invoice is a payment still in progress, such as a SEPA debit or one waiting on 3DS, which the response cannot tell apart. When the payment was refused (a `422` about the `PAYMENT` resource), the customer is told the order's invoice is in their invoice list, waiting to be paid; any other `422`, such as a customer that cannot be invoiced, ends on the generic error. Any other failure ends on a generic error that also points there, since the order may or may not have gone through. Quantities are checked before anything is previewed or charged: a FLAT item takes a whole number of 1 or more, and the order holds until every quantity is one. A refusal the customer can fix keeps them on the order instead: a payment method that can't pay this subscription, items that weren't accepted, or a subscription that can't take orders right now, which also disables the pay button. Every failure is logged with the response's `statusCode`, `field` and `requestId` and an `outcome`: `ON_DEMAND_CHARGE_REFUSED` (warning) for `PAYMENT_METHOD`, `PRICING_ITEMS`, `SUBSCRIPTION_INACTIVE` and `PAYMENT_FAILED`, and `ON_DEMAND_CHARGE_FAILED` (error) for `FAILED`.
- The subscription details screen takes a `canViewCreatedInvoice` option in its `configuration`, `false` by default. When set, the receipt of an on-demand order, and the step shown when the payment of a placed order was refused, offer a "Go to invoice" button that sends the existing `view-invoice` action request; set it only when you handle that action request. Without it, the receipt offers only a button to close it, and an unpaid order tells the customer to find the invoice in their invoice list.
- An invoice with the `SELF_BILLING_UK_DOMESTIC` tax note says, in its invoice summary, that the VAT shown is the customer's output tax due to HMRC.

### Changed

- `INVOICE_PREVIEW_FAILED` and `PAYMENT_METHOD_OPTIONS_LOAD_FAILED` carry the same message wherever they are logged, and name the flow in the context instead: `preview` (`CHECKOUT`, `SUBSCRIPTION_UPGRADE` or `ON_DEMAND_CHARGE`) and `flow` (`CHECKOUT` or `ON_DEMAND_ORDER`). Match on the code and context rather than the message.
- The invoice's wallet balance table (`sv-invoice__credits-breakdown`) reads an invoice line's `wallet_balances`, which replaces the deprecated `wallet_balance_details`, and lists every wallet that paid the invoice. A wallet that holds money rather than credits is now included, shown as an amount under a "Wallet balance" label, and the table's first column reads "Wallet breakdown" instead of "Credit breakdown", as in the portal and the invoice PDF. The column header's message id changed from `invoice_credits.credit_breakdown.table_header` to `invoice_credits.wallet_breakdown.table_header`; a `messages` override for the old id no longer applies, so move it to the new one.
- The invoice summary on the invoice component and the PayInvoice screen lists a discount line directly after the line it applies to, and shows commitment and discount amounts including or excluding tax to match the rest of the invoice.

### Fixed

- Checkout, PayInvoice and the payment method form no longer keep the pay button loading after a submit that never reaches the payment provider, such as one with missing or invalid card details: the customer sees what to fix and can submit again. A Stripe or Adyen submit that fails for any other reason now fails the payment and shows the failure state, instead of being only logged while the button kept loading.
- With Adyen Drop-in, submitting Checkout, PayInvoice or the payment method form while no payment method is open now asks the customer to select one. Drop-in validates only the open payment method, so such a submit showed nothing.
- The pay invoice screen no longer offers a payment method the invoice cannot be paid with. It asked for payment methods by customer alone, so they came back with every acceptor that customer can pay through; an invoice may only accept some of those, and authorizing against one it does not accept failed with `400 Payment acceptor ID is not valid for this invoice` — a dead end the customer could do nothing about, which showed up as a generic payment failure and left them unable to pay at all. The lookup now names the invoice being paid, so the API answers with the acceptors that invoice can be paid through, the way the checkout has always scoped its own lookup by subscription.
- The access token now refreshes, instead of the session ending five minutes in. Identity renews a session from a `refresh-token` cookie it sets on `/oauth/token` and reads back on `/oauth/refresh-token`; the SDK sent both calls with `credentials: 'omit'`, under which the browser discards that cookie from the response and sends none on the refresh. Every refresh answered 401, and `AuthProvider` gave up and raised `SESSION_EXPIRED` once the first token expired. Both identity calls now pass `credentials: 'include'`. Every other request keeps omitting credentials, which is still the default.

## [0.1.0-alpha.25] - 2026-10-06

### Added

- The SEPA Direct Debit mandate now also states the refund rights a customer holds against their own bank: that they are entitled to a refund under the terms of their agreement with that bank, that a claim must be made within 8 weeks of the date the account was debited, and that the bank can supply a statement explaining those rights. The rights are held against the customer's own bank rather than the party collecting the money, so the wording reads the same whether or not the screen knows the billing entity to name.

## [0.1.0-alpha.24] - 2026-10-05

### Added

- The Adyen SEPA Direct Debit form now carries the direct debit mandate — a heading and the authorisation itself, naming the billing entity collecting the money — inside Adyen's own card under the IBAN field, where a customer reads it as they enter the account it applies to. Where the billing entity is not known to the screen, the mandate falls back to wording that does not need the name rather than leaving a gap in the sentence. It appears on no other payment method. Adyen offers no SEPA consent string to override and no slot in that card, so the notice is placed into it and re-placed if Adyen rebuilds the card; the selector that depends on Adyen's internals is pinned by a test, so an upgrade that moves it fails the build rather than quietly dropping a legal notice.
- The checkout screen shows the terms and conditions a merchant set on the checkout page, in a footer under the payment form and order summary, where a customer sees them before paying rather than after. They support the subset the Desk editor can produce — text, bold, italic, underline and hyperlinks — and are rendered as components rather than as markup, so a note can never inject anything into a customer's checkout. Anything outside that subset, a raw tag included, shows as the text it is, and a link the browser should not follow keeps its words and loses its href. A checkout page with no note looks exactly as it did — the footer is not rendered at all.

### Changed

- `ContentWithAsideLayout` takes an optional `footer` slot, rendered full width below the content and aside columns. Screens that pass none render exactly as before.
- A failed API call now rejects with an `ApiError` rather than a plain object. It carries the same `statusCode`, `requestId` and `field` as before, and adds what an object literal could not: a name, a message and a stack. A host forwarding it to their reporter was getting "Object captured as exception with keys: field, hasError, message, requestId, statusCode" as the title of their most important issue; it now reads as the error it is. An error body with no message of its own falls back to `Request failed with status <code>` instead of an empty one.

### Fixed

- A request failure that the SDK handles no longer also reports as an anonymous `UNHANDLED_ERROR`. Every failed request was raised through the UI library's error channel as well as being handled by its caller, and came out under the same codeless code whether it was a declined payment, an expired session or a dropped connection — carrying no status, no request id and no useful stack. Hosts ended up alerting on that entry rather than on the one that said what had happened. A failed request now emits a single `REQUEST_FAILED` entry carrying the method, path, status code and request id, grouped by endpoint and status.
- The token refresh answering 401 no longer raises an error-level entry. It is the expected end of a session, and `AuthProvider` already reports `SESSION_EXPIRED` once it is sure — which is the entry worth waking someone. A caller declares such a status with `expectedStatusCodes`, and the failure drops to `warn` while still rejecting.
- The README's guidance on wiring `onLog` to a reporter is back, and this time outside the auto-generated log-code block that had silently eaten it. It now also guards against reporting a non-`Error` as an exception.

## [0.1.0-alpha.23] - 2026-10-02

### Added

- A failed payment now shows the customer a reference such as `SV-7F3K2A9Q`, with a button to copy it, and asks them to quote it to support. The same reference is on every log entry the visit emits, as `reference`, so one a customer sends leads straight to everything that session logged. It is kept for the browser session, so it survives the 3DS redirect and the error card's own reload, and identifies nothing but the visit.

### Changed

- `LogEntry` carries a required `reference`. A host that only reads entries is unaffected; one that constructs a `LogEntry` of its own — in a test double, say — now has to supply it. The schema version stays at 1, since no existing field changed meaning.

### Fixed

- Failed payments reach `onLog` again. Several paths rendered the error card and emitted nothing at all — the Adyen drop-in reporting a failed payment among them — and those that did log passed the caught error as context rather than as the error, so entries arrived with `error` and `errorSerialized` empty and a host forwarding them to their reporter sent an exception with nothing in it.
- A failed payment is now logged with the gateway, the payment acceptor, the payment method type and, where the Solvimon API refused the call, the `requestId` from its `X-Request-Id` header, which is what joins the entry to its server-side logs.
- The error card tells the customer what actually failed. Every gateway failure was shown as "Something went wrong — an unknown error has occurred", whether the card was declined, the form failed to load or the session had expired.
- The error card is translated. Its titles and messages were hard-coded English and appeared untranslated inside an otherwise localised checkout.
- Three failures that left the customer with no answer now say so: a payment whose details could not be confirmed, which used to leave a spinner that never resolved; a drop-in that failed to mount, which used to leave an empty container; and a drop-in error, which told the screen nothing and so left the pay button spinning for good — it now reaches `payment-failed` like any other failure.
- Apple Pay no longer puts the payment credential in the log. The authorized event was logged whole at `info` level, carrying the encrypted Apple Pay token and the customer's billing contact into the host's log sink; only the shape of what arrived is logged now.

## [0.1.0-alpha.22] - 2026-09-29

### Added

- The checkout now lets a customer choose how many units of a one-off flat item to buy, using a stepper under the seats editor that works the same way. The quantity reprices the invoice preview and is carried into the subscription created at payment. A plan with no such items sends the same requests as before.

### Changed

- A downloaded invoice PDF is now named after the invoice number the customer reads on the document — `invoice-INV-001.pdf` rather than `invoice-inv_01abc....pdf`. The download service takes the invoice it is downloading instead of just its id, and an invoice still waiting for a number falls back to that id.

### Fixed

- The seat and unit counts in the checkout steppers are visible again. Text and feedback elements from `@solvimon/solvimon-ui` had lost their colours, and in the steppers that left the count transparent.

## [0.1.0-alpha.21] - 2026-09-28

### Added

- The payment method form now reports when it has finished. A host driving its own footer can read `isCompleted` and hide the built-in button, and `configuration.successRedirectUrl` — declared until now but read by nobody — puts a Continue button on the confirmation rather than navigating on its own.

### Changed

- Moved to `@solvimon/solvimon-ui` 1.9.1, a patch that leaves the component API as it was. One surface shifts with it: the invoice summary rows carry a smaller text size than before.
- The subscription details screen now loads its schedules on demand rather than up front, which is a fifth less for a host to download to mount it. The schedules only ever rendered once the subscription had arrived, so nothing appears any later than it did.
- The checkout now loads its plan customization editor on demand rather than up front, which is a twentieth less for a host to download to mount it. The editor only ever rendered once the subscription had arrived, so nothing appears any later than it did.
- The Adyen SDK is now loaded through a single entry point, so a bundler can drop the exports the SDK never reaches for. The shared chunk behind every screen that mounts a payment form goes from 581 kB to 444 kB raw, and from 160 kB to 126 kB gzipped.

### Fixed

- A screen is no longer mounted twice while its translations load. Each one was built against the English fallback, then thrown away and built again once its catalogue arrived, so a single checkout asked for two subscriptions, two invoice previews and two sets of payment method options — and the first of each priced a screen the customer never saw. A screen now renders once its catalogue is in, and asks for what it needs once.
- The checkout no longer starts filled in with details from a previous visit. Restoring a form after a payment return failed part way through and left the stored state behind, so the next checkout in that tab silently carried the entries of the one before it.
- The checkout now tells the host about an email address or country code it cannot use. Both were rejected in silence — the value dropped and the field left empty — so an integrator had nothing to go on. A read-only email the checkout rejected also locked an empty field, leaving the customer unable to enter one at all.
- A checkout no longer asks the gateway twice for the payment methods on offer when the country and the amount land in the same tick. A lookup now joins one already in flight for the same request.
- Storing a payment method now updates the list on the payment methods screen. The card previously appeared only after a page reload, on the one screen whose purpose is adding them.
- An invoice that has already been paid is no longer offered a pay button reading €0.00, which threw when pressed.
- Following a payment link to an invoice that cannot be loaded now shows the error. The customer was left on an empty screen with no sign of whether the link was wrong, the invoice gone, or the page still loading.
- Stripe now keeps a card only where the customer said it could. The option that stores the method was set on every payment regardless of the answer, so the pay-invoice checkbox changed nothing. Whether the method is ultimately stored also depends on the API honouring what the payment was created with.
- The payment method form no longer offers a save once the method is stored. The gateway swaps its fields for a confirmation, but the submit button sits a level up and stayed put — most visible with SEPA, which completes without ever leaving the page.
- The success card no longer promises a redirect that is not coming. Only a checkout goes on to redirect; paying an invoice and storing a payment method both end on that card and stay put.
- The SDK no longer writes stray `console` output when loaded as ES modules. Those statements were only ever stripped from the CommonJS build, so the console noise an integration saw depended on which format its bundler picked. Logging through `onLog` and the `log` event is unaffected. The published package is also a tenth smaller to install.

## [0.1.0-alpha.20] - 2026-09-23

### Added

- Paying an invoice now asks whether to keep the payment method. The checkbox is offered ticked, and the one authorization that pays the invoice stores the method with it, so the next invoice can be paid without entering the card again. Unticking it pays the invoice and stores nothing — where the method was stored regardless before.
- Log entries can carry a `fingerprint`, so a consumer forwarding them to their own reporter can group by something narrower than the log code — a misconfigured merchant as one issue rather than one per invoice.
- German (`de-DE`) and Italian (`it-IT`) are now supported locales, fully translated and selectable wherever `en-US` and `nl-NL` already were.

### Changed

- Moved to the `@solvimon/solvimon-ui` 1.9.0 component API, which replaces `Typography`'s `shade` and `Button`'s `color`/`variant` with the semantic `color` and `intent` roles, and the same on `Chip`. Two surfaces shift with it: the invoice table loses its zebra striping and row hover, which the table now decides for itself, and the VAT check button is no longer green, there being no green intent to map it to.
- The invoice table's pay button is now sized to the status chip it stands in for, so the status column keeps one height from row to row.

### Fixed

- A payment gateway that offers no payment methods no longer renders as a blank region. Adyen's drop-in is not mounted when there is nothing to put in it, and the pay-invoice and payment-method-form surfaces say the payment cannot be taken — naming the seller and offering the invoice download — instead of showing an empty form. They also tell loading apart from unavailable, rather than rendering both the same way.
- The promotion code toggle's aria label is now translatable. It built its message and id with a ternary, so FormatJS never extracted either string and the label stayed English in every locale.

## [0.1.0-alpha.19] - 2026-09-03

### Added

- The published package now carries its own type declarations, so building against the SDK no longer requires access to Solvimon's private type packages.
- Pricing plan schedules now show the price customizations that apply to them.
- Added the z-index steps the shared Tailwind config was missing.

### Changed

- Each entry is now loaded on demand and exposes a single export, so a host only pays for the screens and components it actually mounts.
- The shared UI library is now split per entry, which cuts what mounting a single screen pulls in.
- The checkout now confirms a successful sign-up only once the payment has gone through.
- Removed the superseded subscription management screens, along with a number of components nothing mounted: the placeholder components, the payment provider form, the invoice block content components and the customer billing information block.
- Consolidated duplicated internals — one way to read pricings off a schedule, one payment method options composable, one custom element factory, one query string builder, one shell for both wallet modals and one contract for the gateway forms — with no change to behavior.

### Fixed

- Fixed every entry the registry can mount being reachable in the published package, and ESM and CJS entries now carry the file extensions that identify them.
- Fixed the published type declarations not resolving for a consumer.
- Fixed a refreshed access token not being applied, and the token now being read per request.
- Fixed API error messages being reported as a parse failure, and every response now has its media type and status checked.
- Fixed the payment method lookup failing silently in the checkout, which now reports the failure and offers to retry.
- Fixed a partial configuration dropping the options it left out, and the customer overview not passing its configuration to the payment methods block.
- Fixed the Provider being mounted twice in two entry components.
- Fixed translated strings sharing message ids, so each string is translated on its own.
- Stopped shipping a stylesheet that a consumer could not use, and kept the internal environments out of the published package.

## [0.1.0-alpha.18] - 2026-08-24

### Added

- Added automatic wallet top-ups: a customer can set a balance to top itself back up, choosing the level it may drop to, the amount that buys it back and the payment method to charge, and is asked to confirm before an existing one is switched off.
- Added cancelling and renewing a subscription from inside the SDK, confirmation modal included, so the host no longer has to handle either itself.
- Added deleting a saved payment method.
- The Subscription Details screen now shows the payment method a subscription is billed to.
- A wallet top-up now asks which subscription it is bought for when more than one could carry it, and offers only the on-demand items that subscription actually prices.

### Changed

- A top-up now requires a payment method before it can be charged, and says so plainly when the customer has none to choose from — in the checkout as well as the top-up modal.
- The wallet top-up and automatic top-up flows now step sideways between panes, so a customer who leaves to add a payment method returns to the choice they were part-way through rather than starting it again.
- Expanded resources are now requested with a single "expand all" parameter rather than listing each relation, which means responses carry every expandable relation.
- A subscription now always starts at the moment it is created.
- The delete payment method confirmation now matches the subscription cancellation one.
- Tightened the spacing of empty states and of the rows listing enabled pricings.
- Updated the shared Solvimon UI package to 1.7.8.

### Fixed

- Fixed the payment method error being hidden when the customer had no methods to choose from.
- Fixed an error left over on a modal after it was closed and opened again.
- Fixed a class passed to a modal being dropped instead of applied.
- Fixed reported dependency security advisories.

## [0.1.0-alpha.17] - 2026-08-13

### Added

- Added a Subscription Details screen showing a subscription's plan, wallet balances, and the upgrades available on it.
- Added a Subscription Management screen where customers can change the plan a running subscription is on, with an order summary that prices the change before it is committed and a confirmation once it goes through.
- Added wallet top-ups: customers can top up a balance from the customer overview and see what the top-up will be invoiced for before paying.
- Added the ability to apply a promotion code during checkout, including codes supplied up front.
- Added a modal for adding a payment method, so a customer adding one mid-flow keeps the choice they were making.
- Added a payment method selector for choosing between saved payment methods.
- SDK logs are now mirrored to the browser console outside production.

### Changed

- Upgrading is now offered per pricing on the Subscription Details screen instead of by a single button on the subscriptions list. The list's `showUpgradeButton` configuration option has been removed along with it.
- The Upgrade Subscription screen is now called Subscription Management.
- The payment method form can now be driven by the surrounding screen, which can submit it, hide its button, and set its title.
- Adding a payment method is now only offered when the customer has methods available to add; otherwise the selector says none are available.
- Wallet balances are now rendered with the shared Solvimon UI component.

### Fixed

- Fixed component styles from the Solvimon UI package not reaching the SDK's components, which left parts of the interface unstyled.
- Fixed the checkout silently loading nothing when a subscription's response left out its nested schedule: neither the invoice preview nor the available payment methods appeared, and no error was reported.
- Fixed classes passed to the promotion code section and the seats editor being dropped instead of applied.

## [0.1.0-alpha.16] - 2026-07-28

### Fixed

- Fixed the Stripe payment form failing to load when the portal is embedded inside another site's iframe.

## [0.1.0-alpha.15] - 2026-07-27

### Added

- Added a Payment Methods Management screen where customers can view, add, and manage their saved payment methods.
- Added a Payment Methods list component.
- Added Stripe as a payment provider alongside Adyen across the checkout and payment flows.
- Added the ability to set a default payment method.
- Added an Invoice header that surfaces key invoice summary details.
- Added an optional `name` prop to the payment form.
- Added an `X-Client-Version` header to outgoing API requests.

### Changed

- The pay button now shows a loading state while a payment is being processed.
- Checkout form state is now preserved and restored across payment redirects.
- Express payment methods are now shown only for Adyen.
- The screen aside is now optional.
- Removed the "Continue to merchant" button from the payment flow.
- Improved the authentication mechanism.

### Fixed

- Fixed the Invoice component ignoring its resolved props.
- Fixed list items not resetting when the initial page of data is refetched.

## [0.1.0-alpha.14] - 2026-06-17

### Added

- Added support for on-demand items when upgrading subscriptions.

## [0.1.0-alpha.13] - 2026-05-30

### Fixed

- Fixed the invoice preview not updating when form fields, seat values, or enabled pricing selections change in the checkout flow.

## [0.1.0-alpha.12] - 2026-05-29

### Fixed

- Fixed the payment button remaining disabled after selecting a payment method in the drop-in.

## [0.1.0-alpha.11] - 2026-05-29

### Fixed

- Fixed payment authorization and tokenization incorrectly reporting success when the payment was refused by the gateway.

## [0.1.0-alpha.10] - 2026-05-29

### Changed

- Adyen CSS is now inlined into the bundle instead of loaded via a `<link>` tag, fixing a MIME-type error in consumer apps that don't serve static assets from the SDK.

## [0.1.0-alpha.9] - 2026-05-28

### Added

- Added structured error and warning logging with log-level control via the `logLevel` prop.
- Added `useWatchAsync` composable for watching async operations with reactive loading state.
- Added support for custom CSS class overrides on SDK components.
- Added comprehensive SDK documentation for error codes, warnings, and component usage.

### Changed

- Logger now emits structured log lines instead of raw `console` calls, making it easier to integrate with external log collectors.
- Default log level changed from `info` to `warn` to reduce noise in production.
- Adyen CSS is now loaded lazily via a `<link>` tag injected into the shadow root, avoiding a blocking stylesheet request on page load.

### Fixed

- Fixed translation loading when used with the async guard pattern.
- Fixed a structured-clone bug that caused computed objects to be incorrectly shared across instances.

## [0.1.0-alpha.8] - 2026-05-22

### Added

- Added a pay-invoice screen for processing outstanding invoice payments.
- Added a `PayButton` component for triggering payment actions inline.
- Added a new details object to the payment response for richer post-payment data.
- Added a payments-by-Adyen KPI metric to the billing overview.

### Changed

- Adyen payment integration is now lazy-loaded, reducing the initial bundle size.
- `PaymentHistoryBlock` inside the Invoice component is now lazy-loaded, reducing the initial bundle size.
- Translations are dynamically loaded at runtime instead of being bundled upfront.
- Replaced `lodash` `cloneDeep` with native `structuredClone` and removed the `lodash` runtime dependency.
- Improved JSON parsing robustness in API response handling.
- Refactored payment method selection flow and checkout redirect handling.

### Fixed

- Fixed XSS vulnerability in checkout redirect handling by sanitizing redirect URLs before navigation.
- Fixed security vulnerability in `js-cookie` (CVE-2026-46625, prototype hijack via `assign()`).

## [0.1.0-alpha.7] - 2026-05-13

### Added

- Added tax ID validation to the checkout form. A composable validates the customer's tax ID against the API and displays an inline notice when validation fails.
- Added a playground with all screens and components for local iteration.
- Added TypeScript declaration files to the build output.
- Added a bundle size comparison bot that posts results as a PR comment on every pull request.
- Added a coverage report step to the CI pipeline.
- Added automatic GitHub Release creation with changelog notes on every release tag.

### Changed

- `BillingInformation` component now loads initial customer data on mount instead of requiring the parent to pass it in.
- Lazy-load Adyen CSS to reduce the initial bundle size.
- Switched to tree-shakable `lodash-es` named imports to reduce bundle size.
- Improved the `watch` script to run JS and CSS builds in parallel.

### Fixed

- Fixed `Checkout` filtering seat quantity inputs by the active billing period only.
- Fixed the email field in the billing information form not updating correctly.
- Fixed security vulnerabilities reported by Dependabot.

## [0.1.0-alpha.6] - 2026-05-07

### Changed

- Published a release pipeline test version. No package behavior changes are included in this release.

## [0.1.0-alpha.5] - 2026-05-06

### Fixed

- Fixed Tailwind CSS content paths that were broken after migrating from `@solvimon/tailwind-config`. The old config resolved to a path two directories above the project root and pointed to source files that are not published in the UI package. The config now scans the UI package's compiled `dist/` bundles, restoring all missing utility classes.
- Fixed TypeScript errors caused by breaking API changes in `@solvimon/solvimon-ui` (renamed/removed props, stricter component types).
- Fixed `Checkout` entry component passing props as flat attributes instead of the expected `configuration` object, which caused `avatar`, `email`, `countryCode`, and `enabledPricingIds` to be silently ignored.

## [0.1.0-alpha.4] - 2026-05-05

### Added

- Added changelog enforcement before release tag creation.
- Added automatic `v<version>` release tag creation when the root package version changes on `main`.
- Added a tag-based npm publish workflow for release tags.
- Added publishing documentation for the GitHub Actions release flow.

### Changed

- Split release publishing out of the main CI workflow.
- Simplified the publish workflow to verify the release tag matches the package version before publishing.
- Updated the main README to link to the dedicated publishing documentation.
- Moved publishing documentation to `docs/development/publish.md`.

### Fixed

- Fixed `InvoicesList` not loading its initial invoice data.

## [0.1.0-alpha.3] - 2026-05-05

### Added

- Initial alpha release.

[Unreleased]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.9...HEAD
[0.1.0-alpha.9]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.8...v0.1.0-alpha.9
[0.1.0-alpha.8]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.7...v0.1.0-alpha.8
[0.1.0-alpha.7]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.6...v0.1.0-alpha.7
[0.1.0-alpha.6]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.5...v0.1.0-alpha.6
[0.1.0-alpha.5]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.4...v0.1.0-alpha.5
[0.1.0-alpha.4]: https://github.com/Solvimon/solvimon-web/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/Solvimon/solvimon-web/releases/tag/v0.1.0-alpha.3
