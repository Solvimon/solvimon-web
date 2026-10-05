/**
 * Where the SEPA mandate notice is placed, inside Adyen's own card.
 *
 * Adyen builds the modifier from the payment method's type (`payment-method--${type}`), which is
 * what scopes this to SEPA rather than every method's form. These class names are not a public
 * API, so `findSepaNoticeTarget` is covered by a test: an Adyen upgrade that moves them fails
 * loudly instead of silently dropping a legal notice.
 */
export const SEPA_NOTICE_SELECTOR =
    '.adyen-checkout__payment-method--sepadirectdebit .adyen-checkout__payment-method__details__content';

export function findSepaNoticeTarget(
    container: HTMLElement | null | undefined,
): HTMLElement | null {
    return container?.querySelector<HTMLElement>(SEPA_NOTICE_SELECTOR) ?? null;
}

/**
 * Whether the notice has to be mounted afresh rather than left where it is.
 *
 * The card belongs to Adyen's renderer, which re-creates it on its own schedule and takes our node
 * with it. Vue has no way to notice that, so the teleport target is cleared and re-set to force a
 * new node into the new card.
 */
export function hasLostSepaNotice(
    target: HTMLElement | null,
    notice: HTMLElement | null | undefined,
): boolean {
    return !!target && !!notice && !target.contains(notice);
}

export const getOverriddenTranslations = (variant: 'TOKENIZE' | 'AUTHORIZE') => {
    let result: Record<string, Record<string, string>> = {};

    if (variant === 'TOKENIZE') {
        result = {
            'en-US': {
                payButton: 'Add payment method',
                confirmPurchase: 'Add payment method',
            },
            'fr-FR': {
                payButton: 'Ajouter un moyen de paiement',
                confirmPurchase: 'Ajouter un moyen de paiement',
            },
            'de-DE': {
                payButton: 'Zahlungsmethode hinzufügen',
                confirmPurchase: 'Zahlungsmethode hinzufügen',
            },
            'it-IT': {
                payButton: 'Aggiungi metodo di pagamento',
                confirmPurchase: 'Aggiungi metodo di pagamento',
            },
            'es-ES': {
                payButton: 'Añadir método de pago',
                confirmPurchase: 'Añadir método de pago',
            },
            'nl-NL': {
                payButton: 'Betaalmethode toevoegen',
                confirmPurchase: 'Betaalmethode toevoegen',
            },
            'pt-BR': {
                payButton: 'Adicionar método de pagamento',
                confirmPurchase: 'Adicionar método de pagamento',
            },
            'pt-PT': {
                payButton: 'Adicionar método de pagamento',
                confirmPurchase: 'Adicionar método de pagamento',
            },
            'pl-PL': {
                payButton: 'Dodaj metodę płatności',
                confirmPurchase: 'Dodaj metodę płatności',
            },
            'ru-RU': {
                payButton: 'Добавить способ оплаты',
                confirmPurchase: 'Добавить способ оплаты',
            },
            'sv-SE': {
                payButton: 'Lägg till betalningsmetod',
                confirmPurchase: 'Lägg till betalningsmetod',
            },
            'da-DK': {
                payButton: 'Tilføj betalingsmetode',
                confirmPurchase: 'Tilføj betalingsmetode',
            },
            'fi-FI': {
                payButton: 'Lisää maksutapa',
                confirmPurchase: 'Lisää maksutapa',
            },
            'no-NO': {
                payButton: 'Legg til betalingsmetode',
                confirmPurchase: 'Legg til betalingsmetode',
            },
            'cs-CZ': {
                payButton: 'Přidat platební metodu',
                confirmPurchase: 'Přidat platební metodu',
            },
            'hu-HU': {
                payButton: 'Fizetési mód hozzáadása',
                confirmPurchase: 'Fizetési mód hozzáadása',
            },
            'ro-RO': {
                payButton: 'Adăugați metodă de plată',
                confirmPurchase: 'Adăugați metodă de plată',
            },
            'ja-JP': {
                payButton: '支払い方法を追加',
                confirmPurchase: '支払い方法を追加',
            },
            'ko-KR': {
                payButton: '결제 수단 추가',
                confirmPurchase: '결제 수단 추가',
            },
            'zh-CN': {
                payButton: '添加支付方式',
                confirmPurchase: '添加支付方式',
            },
            'zh-TW': {
                payButton: '新增付款方式',
                confirmPurchase: '新增付款方式',
            },
            ar: {
                payButton: 'إضافة وسيلة دفع',
                confirmPurchase: 'إضافة وسيلة دفع',
            },
            'hr-HR': {
                payButton: 'Dodajte način plačanja',
                confirmPurchase: 'Dodajte način plačanja',
            },
            'el-GR': {
                payButton: 'Προσθήκη μεθόδου πληρωμής',
                confirmPurchase: 'Προσθήκη μεθόδου πληρωμής',
            },
            'sk-SK': {
                payButton: 'Pridať spôsob platby',
                confirmPurchase: 'Pridať spôsob platby',
            },
            'sl-SI': {
                payButton: 'Dodajte način plačanja',
                confirmPurchase: 'Dodajte način plačanja',
            },
            'bg-BG': {
                payButton: 'Добавяне на начин на плащане',
                confirmPurchase: 'Добавяне на начин на плащане',
            },
            'ca-ES': {
                payButton: 'Afegir mètode de pagament',
                confirmPurchase: 'Afegir mètode de pagament',
            },
            'et-EE': {
                payButton: 'Lisa makseviis',
                confirmPurchase: 'Lisa makseviis',
            },
            'lv-LV': {
                payButton: 'Pievienot maksājuma veidu',
                confirmPurchase: 'Pievienot maksājuma veidu',
            },
            'lt-LT': {
                payButton: 'Pridėti mokėjimo metodą',
                confirmPurchase: 'Pridėti mokėjimo metodą',
            },
        };
    }

    return result;
};
