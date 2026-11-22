/**
 * A list cut short at `limit`, with a line below it counting the items left out. Only for lists that are
 * meant to be shortened; a list that shows every item renders its own markup instead.
 */
export interface LimitedListProps<T> {
    items: T[];
    /** How many items to show; the rest are counted below them. */
    limit: number;
    /** A stable key per item. */
    itemKey: (item: T) => string;
    /**
     * Opens every item. Given, the line below the list is a "Show all" link with the total; without
     * it, the line only counts the items left out.
     */
    showAll?: () => void;
    /** Classes for each item's `<li>`, such as a block's public `sv-*` hook. */
    itemClass?: string;
    /** Classes for the `<li>` that counts the items left out. */
    moreClass?: string;
}
