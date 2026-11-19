export interface LimitedListProps<T> {
    items: T[];
    /** How many items to show; the rest are counted in a card below them. Left out, all show. */
    limit?: number;
    /** A stable key per item. */
    itemKey: (item: T) => string;
    /** Classes for each item's `<li>`, such as a block's public `sv-*` hook. */
    itemClass?: string;
    /** Classes for the `<li>` of the card that counts the items left out. */
    moreClass?: string;
}
