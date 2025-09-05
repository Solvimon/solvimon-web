export interface PlaceholderProps {
    /**
     * Shows a loading gradient animation for the placeholder by default.
     * To disable, set animated to `false`.
     *
     * @default true
     */
    animated?: boolean;
    /**
     * @default false
     */
    contentReady?: boolean;
    /**
     * Optional classes for the root element containing the placeholder and the slot
     */
    rootClass?: string;
    /**
     * Optional classes for the placeholder
     */
    placeholderClass?: string;
}
