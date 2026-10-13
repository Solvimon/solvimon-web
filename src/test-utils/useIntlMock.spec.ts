import { mockUseIntl } from './useIntlMock';

const { $t } = mockUseIntl();

describe('mockUseIntl', () => {
    it('formats plurals', () => {
        const message = {
            id: 'customer_overview.payment_methods.title',
            defaultMessage: '{count, plural, one {Payment method} other {Payment methods}}',
        };

        expect($t(message, { count: 1 })).toBe('Payment method');
        expect($t(message, { count: 2 })).toBe('Payment methods');
    });

    it('reads the message from the en-US catalogue, not the call site', () => {
        expect($t({ id: 'topup_modal.cancel_button.label', defaultMessage: 'Stale' })).toBe(
            'Cancel',
        );
    });

    it('falls back to the default message for an id the catalogue does not have', () => {
        expect($t({ id: 'spec.only', defaultMessage: 'Hello {name}' }, { name: 'Ada' })).toBe(
            'Hello Ada',
        );
    });

    it('renders tags through the handler passed in', () => {
        expect(
            $t(
                { id: 'spec.only', defaultMessage: 'Pay <strong>{price}</strong> now' },
                { price: '€10', strong: (chunks: string[]) => `<b>${chunks.join('')}</b>` },
            ),
        ).toBe('Pay <b>€10</b> now');
    });

    it('fails on a placeholder without a value', () => {
        expect(() => $t({ id: 'spec.only', defaultMessage: 'Hello {name}' }, {})).toThrow(
            /FORMAT_ERROR/,
        );
    });

    it('fails on a tag without a handler', () => {
        expect(() => $t({ id: 'spec.only', defaultMessage: 'Pay <strong>now</strong>' })).toThrow(
            /FORMAT_ERROR/,
        );
    });

    it('fails on a message that does not parse', () => {
        expect(() => $t({ id: 'spec.only', defaultMessage: 'Hello {name' }, { name: 'x' })).toThrow(
            /FORMAT_ERROR/,
        );
    });
});
