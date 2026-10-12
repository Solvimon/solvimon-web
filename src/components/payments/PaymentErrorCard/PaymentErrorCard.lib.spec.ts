import { createIntl, createIntlCache } from '@formatjs/intl';
import type { MessageDescriptor } from '@formatjs/intl';
import { createErrorMap } from './PaymentErrorCard.lib';
import type { SdkError } from '@/types/errors';
import { mockUseIntl, throwOnIntlError } from '@/test-utils/useIntlMock';
import nlNL from '@/translations/locales/nl-NL.json';

type Translate = Parameters<typeof createErrorMap>[0];

const ALL_CODES: SdkError['code'][] = [
    'UNKNOWN_ERROR',
    'AUTHORIZATION_FAILED',
    'PAYMENT_DETAILS_CALL_FAILED',
    'PAYMENT_OUTCOME_UNCONFIRMED',
    'PAYMENT_METHOD_STORAGE_FAILED',
    'REDIRECT_RESULT_PAYMENT_ACCEPTOR_MISSING',
    'TOKENIZE_FAILED',
    'PAYMENT_INTEGRATION_INITIALIZATION_FAILED',
    'RESOURCE_REVOKED',
];

const englishMap = () => createErrorMap(mockUseIntl().$t as Translate);

describe('createErrorMap', () => {
    it('has an entry for exactly the known error codes', () => {
        expect(Object.keys(englishMap()).sort()).toEqual([...ALL_CODES].sort());
    });

    it('gives every code a non-empty title and message', () => {
        const map = englishMap();

        for (const code of ALL_CODES) {
            expect(map[code].title.trim()).not.toBe('');
            expect(map[code].message.trim()).not.toBe('');
        }
    });

    it('translates each line under an id named after its code', () => {
        const ids: string[] = [];
        const $t = ((descriptor: MessageDescriptor) => {
            ids.push(String(descriptor.id));
            return String(descriptor.defaultMessage);
        }) as Translate;

        createErrorMap($t);

        const expected = ALL_CODES.flatMap((code) => [
            `payments.error_card.${code.toLowerCase()}.title`,
            `payments.error_card.${code.toLowerCase()}.message`,
        ]);
        expect(ids.sort()).toEqual(expected.sort());
    });

    it('tells the customer what went wrong in English', () => {
        const map = englishMap();

        expect(map.AUTHORIZATION_FAILED).toEqual({
            title: 'Payment failed',
            message:
                'The payment could not be completed. Try again, or use a different payment method.',
            isRetryButtonVisible: true,
        });
        expect(map.RESOURCE_REVOKED.title).toBe('This page is no longer available');
        expect(map.PAYMENT_INTEGRATION_INITIALIZATION_FAILED.message).toBe(
            'The payment form could not be loaded.',
        );
    });

    it('speaks the language of the translator it is given', () => {
        const intl = createIntl(
            {
                locale: 'nl-NL',
                defaultLocale: 'en-US',
                messages: nlNL,
                onError: throwOnIntlError,
            },
            createIntlCache(),
        );
        const dutch = createErrorMap(((descriptor: MessageDescriptor) =>
            intl.formatMessage(descriptor)) as Translate);

        expect(dutch.AUTHORIZATION_FAILED.title).toBe('Betaling mislukt');
        expect(dutch.AUTHORIZATION_FAILED.title).not.toBe(englishMap().AUTHORIZATION_FAILED.title);
    });

    it('does not describe two failures with the same title and message', () => {
        const map = englishMap();
        const lines = ALL_CODES.map((code) => `${map[code].title}|${map[code].message}`);

        expect(new Set(lines).size).toBe(ALL_CODES.length);
    });

    it('offers a retry everywhere except where a retry cannot help or could charge twice', () => {
        const map = englishMap();
        const withoutRetry: SdkError['code'][] = [
            'REDIRECT_RESULT_PAYMENT_ACCEPTOR_MISSING',
            'PAYMENT_OUTCOME_UNCONFIRMED',
        ];

        for (const code of ALL_CODES) {
            expect(map[code].isRetryButtonVisible, code).toBe(
                withoutRetry.includes(code) ? undefined : true,
            );
        }
    });
});
