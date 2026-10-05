import { describe, expect, it } from 'vitest';
import {
    findSepaNoticeTarget,
    getOverriddenTranslations,
    hasLostSepaNotice,
    SEPA_NOTICE_SELECTOR,
} from './PaymentIntegrationFormAdyen.lib';

/**
 * The drop-in as Adyen renders it: a card per payment method, each carrying a modifier built from
 * the method's type. Hand-built because the spec's Adyen mock renders no DOM of its own.
 */
const dropIn = (...types: string[]) => {
    const container = document.createElement('div');
    container.innerHTML = types
        .map(
            (type) => `
            <div class="adyen-checkout__payment-method adyen-checkout__payment-method--${type}">
                <div class="adyen-checkout__payment-method__header">${type}</div>
                <div class="adyen-checkout__payment-method__details">
                    <div class="adyen-checkout__payment-method__details__content"></div>
                </div>
            </div>`,
        )
        .join('');
    return container;
};

describe('findSepaNoticeTarget', () => {
    it('finds the content area of the SEPA card', () => {
        const target = findSepaNoticeTarget(dropIn('scheme', 'sepadirectdebit', 'paypal'));

        expect(target).not.toBeNull();
        expect(target?.className).toContain('adyen-checkout__payment-method__details__content');
        expect(target?.closest('.adyen-checkout__payment-method')?.className).toContain(
            'adyen-checkout__payment-method--sepadirectdebit',
        );
    });

    // The whole point of scoping: the notice is a SEPA mandate, not a message for every method.
    it('finds nothing when the drop-in offers no SEPA', () => {
        expect(findSepaNoticeTarget(dropIn('scheme', 'paypal', 'ideal'))).toBeNull();
    });

    it('does not reach into another payment method card', () => {
        const container = dropIn('scheme', 'sepadirectdebit');
        const target = findSepaNoticeTarget(container);
        const cards = container.querySelectorAll('.adyen-checkout__payment-method');

        expect(cards[0].contains(target)).toBe(false);
        expect(cards[1].contains(target)).toBe(true);
    });

    it('copes with no container at all', () => {
        expect(findSepaNoticeTarget(null)).toBeNull();
        expect(findSepaNoticeTarget(undefined)).toBeNull();
    });

    /**
     * These class names are Adyen's internals, not a published API. If an upgrade renames them this
     * fails here rather than silently dropping a legal notice from the SEPA form in production.
     */
    it('pins the selector it depends on', () => {
        expect(SEPA_NOTICE_SELECTOR).toBe(
            '.adyen-checkout__payment-method--sepadirectdebit .adyen-checkout__payment-method__details__content',
        );
    });
});

describe('hasLostSepaNotice', () => {
    const target = () =>
        dropIn('sepadirectdebit').querySelector<HTMLElement>(
            '.adyen-checkout__payment-method__details__content',
        )!;

    it('says so once Adyen has re-created the card without our node', () => {
        const detached = document.createElement('div');

        expect(hasLostSepaNotice(target(), detached)).toBe(true);
    });

    it('leaves a notice that is still in place alone', () => {
        const stillThere = target();
        const notice = document.createElement('div');
        stillThere.appendChild(notice);

        expect(hasLostSepaNotice(stillThere, notice)).toBe(false);
    });

    it('asks for nothing before either side exists', () => {
        expect(hasLostSepaNotice(null, document.createElement('div'))).toBe(false);
        expect(hasLostSepaNotice(target(), null)).toBe(false);
    });
});

describe('getOverriddenTranslations', () => {
    it('relabels the pay button when storing a method rather than paying', () => {
        expect(getOverriddenTranslations('TOKENIZE')['en-US'].payButton).toBe('Add payment method');
    });

    it('leaves the Adyen wording alone when authorizing', () => {
        expect(getOverriddenTranslations('AUTHORIZE')).toEqual({});
    });
});
