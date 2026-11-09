/**
 * The branding an element is shown in. The platform branding the API returns fits it as it is, so
 * a host can pass that on without picking fields out.
 */
export interface SolvimonBranding {
    /** The brand's colours, for the buttons, links and highlights of every element. */
    colors?: {
        primary?: string;
        secondary?: string;
    };
    /** Shown as the avatar where a screen has one: the checkout's order summary, a subscription. */
    emblem?: {
        public_url?: string;
    };
}
